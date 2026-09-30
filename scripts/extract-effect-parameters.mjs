// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
// Regenerate the parameter inventory from the actual effect implementations.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const inventory = {};
for (const file of fs.readdirSync('src/effects').filter(f => f.endsWith('.ts') && !['base.ts', 'index.ts'].includes(f))) {
  const source = fs.readFileSync(path.join('src/effects', file), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const type = source.match(/readonly name\s*=\s*['"]([^'"]+)/)?.[1];
  if (!type) continue;
  const constants = new Map();
  const unions = new Map();
  function literals(node, depth = 0) {
    if (!node || depth > 8) return undefined;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) return literals(node.expression, depth + 1);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isIdentifier(node)) return literals(constants.get(node.text), depth + 1);
    if (ts.isPrefixUnaryExpression(node)) {
      const n = literals(node.operand, depth + 1);
      if (typeof n === 'number') return node.operator === ts.SyntaxKind.MinusToken ? -n : n;
    }
    if (ts.isArrayLiteralExpression(node)) {
      const items = node.elements.map(e => literals(e, depth + 1));
      if (items.every(e => e !== undefined)) return items;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const p of node.properties) {
        if (!ts.isPropertyAssignment(p)) return undefined;
        const value = literals(p.initializer, depth + 1);
        if (value === undefined) return undefined;
        result[p.name.getText(tree).replace(/['"]/g, '')] = value;
      }
      return result;
    }
    return undefined;
  }
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) constants.set(node.name.text, node.initializer);
    if (ts.isTypeAliasDeclaration(node) && ts.isUnionTypeNode(node.type)) {
      const values = node.type.types.filter(ts.isLiteralTypeNode).map(t => literals(t.literal));
      if (values.length === node.type.types.length) unions.set(node.name.text, values);
    }
    ts.forEachChild(node, collect);
  }
  collect(tree);
  const fields = {};
  const localKeys = new Map();
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ['this.config', 'config', 'windowConfig'].includes(node.expression.getText(tree))) {
      const key = node.name.text;
      if (key.startsWith('_')) return;
      let parent = node.parent;
      let options;
      while (ts.isAsExpression(parent) || ts.isParenthesizedExpression(parent)) {
        if (ts.isAsExpression(parent)) options = unions.get(parent.type.getText(tree).replace(/\[\]$/, ''));
        parent = parent.parent;
      }
      let value;
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && parent.left.getText(tree).includes(node.getText(tree))) value = literals(parent.right);
      const previous = fields[key] ?? {};
      const kind = Array.isArray(value) ? 'array' : value !== undefined ? typeof value : previous.type ?? 'unknown';
      const definition = { ...previous, type: kind };
      if (value !== undefined) definition.default = value;
      if (options) definition.options = options;
      if (kind === 'number') {
        if (/^(alpha|opacity|reactivity)$|Alpha$|Opacity$|Prob$/.test(key)) Object.assign(definition, { min: 0, max: 1, step: 0.01 });
        else if (key === 'alphaThreshold') Object.assign(definition, { min: 0, max: 255, step: 1 });
        else if (/count|cols|rows|points|rays|iterations|seed|interval/i.test(key)) Object.assign(definition, { min: 0, step: 1 });
        else definition.step = 0.01;
      }
      fields[key] = definition;
      let declaration = node.parent;
      while (declaration && !ts.isVariableDeclaration(declaration) && !ts.isStatement(declaration)) declaration = declaration.parent;
      if (declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
        localKeys.set(declaration.name.text, key);
        const expression = declaration.initializer?.getText(tree) ?? '';
        const min = expression.match(/Math\.max\(\s*([\d.]+)\s*,/);
        if (min && kind === 'number') definition.min = Number(min[1]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  // Enumerated modes are also expressed as comparisons / switch cases in older effects.
  function modes(node) {
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind)) {
      const key = localKeys.get(node.left.getText(tree)) ?? (node.left.getText(tree).startsWith('this.config.') ? node.left.getText(tree).slice(12) : undefined);
      const value = literals(node.right);
      if (key && typeof value === 'string' && fields[key]?.type === 'string') fields[key].options = [...new Set([fields[key].default, ...(fields[key].options ?? []), value].filter(v => v !== undefined))];
    }
    if (ts.isSwitchStatement(node)) {
      const key = localKeys.get(node.expression.getText(tree));
      if (key && fields[key]) {
        const options = node.caseBlock.clauses.filter(ts.isCaseClause).map(c => literals(c.expression)).filter(v => typeof v === 'string');
        if (options.length) fields[key].options = options;
      }
    }
    ts.forEachChild(node, modes);
  }
  modes(tree);
  const fixedColors = [...new Set([...source.matchAll(/this\.color\(['"](#[\da-fA-F]{6,8})['"]\)/g)].map(m => m[1]))];
  if (fixedColors.length) fields.colorOverrides = { type: 'object', default: Object.fromEntries(fixedColors.map(c => [c, c])) };
  inventory[type] = fields;
}
const header = '// PV Tool — Copyright (c) 2026 DanteAlighieri13210914\n// Licensed under Non-Commercial License. See LICENSE for terms.\n// Generated by scripts/extract-effect-parameters.mjs; supplement dynamic defaults in effectParameters.ts.\n';
fs.writeFileSync('src/core/effectParameterInventory.ts', header + 'export const effectParameterInventory: Record<string, Record<string, { type: string; default?: any; options?: any[]; min?: number; max?: number; step?: number }>> = ' + '{\n' + Object.entries(inventory).map(([type, fields]) => '  ' + JSON.stringify(type) + ': {\n' + Object.entries(fields).map(([key, def]) => '    ' + JSON.stringify(key) + ': ' + JSON.stringify(def)).join(',\n') + '\n  }').join(',\n') + '\n}' + ';\n');
console.log(`Inventoried ${Object.keys(inventory).length} effects / ${Object.values(inventory).reduce((n, fields) => n + Object.keys(fields).length, 0)} parameters.`);
