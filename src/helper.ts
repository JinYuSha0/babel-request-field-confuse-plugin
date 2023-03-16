import * as Babel from '@babel/core';
import Path from 'path';
import fs from 'fs';

export const TEMP = {
  pathMapping: null,
  paramMapping: null,
  keySet: new Set(),
};

export function getImportPath(
  path: Babel.NodePath<Babel.types.ImportDeclaration>,
  state: Babel.PluginPass
): string {
  return Path.join(
    Path.dirname(state.file.opts.filename),
    path.node.source.value
  );
}

export function analysePathMapping(content: string): Record<string, string> {
  if (TEMP.pathMapping) return TEMP.pathMapping;
  const result = Object.create(null);
  try {
    content.split('\n').forEach(row => {
      const [_, original, obscure] = row.match(
        /mapping path.key=\s*?([^\s]*)\s*?->\s*?value=\s*(.*)/
      );
      result[original] = obscure;
    });
    TEMP.pathMapping = result;
  } catch (_) {}
  return result;
}

export function analyseParamMapping(content: string): Record<string, string> {
  if (TEMP.paramMapping) return TEMP.paramMapping;
  const result = Object.create(null);
  try {
    content.split('\n').forEach(row => {
      const [_, original, obscure] = row.match(
        /mapping param.key=\s*?([^\s]*)\s*?->\s*?value=\s*(.*)/
      );
      result[original] = obscure;
    });
    TEMP.paramMapping = result;
  } catch (_) {}
  return result;
}

export function readFile(path: string) {
  return fs.readFileSync(path).toString();
}

export function removeFileExtname(filename: string) {
  return filename.replace(Path.extname(filename), '');
}
