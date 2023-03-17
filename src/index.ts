import type { PluginObj, PluginPass } from '@babel/core';
import * as Babel from '@babel/core';
import * as Helper from './helper';

interface InputParams {
  srcPath: string;
  blackPath: string[];
  requestMethodFile: string;
  mappingPathFile: string;
  mappingParamFile: string;
  formInstanceMethod: string[];
  ignoreObjectName: string[];
  detectIgnoreObject?: (
    path: Babel.NodePath<Babel.types.ObjectExpression>
  ) => boolean;
}

type ObjectMember =
  | Babel.types.ObjectMethod
  | Babel.types.ObjectProperty
  | Babel.types.SpreadElement;

type DetectIsProcessPropertyResult = {
  key: Babel.types.Expression | Babel.types.PrivateName;
  value: Babel.types.ObjectProperty['value'];
} | null;

interface InnerAttribute {
  ignorePath: boolean;
  mappingPath: Record<string, string>;
  mappingParam: Record<string, string>;
  detectParam: (name: string) => boolean;
  getMappingParmaName: (name: string) => string;
  detectIsProcessProperty: (e: ObjectMember) => DetectIsProcessPropertyResult;
}

function detectIsProcessProperty(
  e: ObjectMember
): DetectIsProcessPropertyResult {
  if (e.type === 'ObjectProperty') {
    if (e.computed) return;
    const keyType = e.key.type;
    let key: string;
    let name: string;
    if (keyType === 'Identifier') {
      key = 'name';
      name = e.key.name;
    } else if (keyType === 'StringLiteral') {
      key = 'value';
      name = e.key.value;
    }
    if (!!this.mappingParam[name]) {
      return {
        key: { ...e.key, [key]: this.mappingParam[name] },
        value: e.value,
      };
    }
    return null;
  }
}

export default function (
  { types: t }: typeof Babel,
  opt: InputParams
): PluginObj<PluginPass & InnerAttribute> {
  return {
    name: 'babel-request-field-confuse-plugin',
    pre(file) {
      if (!opt.srcPath || !opt.requestMethodFile)
        throw new Error('params error');
      opt.requestMethodFile = Helper.removeFileExtname(opt.requestMethodFile);
      let ignore = !file.opts.filename.startsWith(opt.srcPath);
      if (!ignore) {
        opt.blackPath.forEach(path => {
          if (file.opts.filename.startsWith(path)) {
            ignore = true;
            return;
          }
        });
      }
      this.ignorePath = ignore;
      this.calleeObjIdentifierName = '';
      this.mappingPath = Helper.analysePathMapping(
        Helper.readFile(opt.mappingPathFile)
      );
      this.mappingParam = Helper.analyseParamMapping(
        Helper.readFile(opt.mappingParamFile)
      );
      this.detectIsProcessProperty = detectIsProcessProperty.bind(this);
      this.detectParam = (name: string) => !!this.mappingParam[name];
      this.getMappingParmaName = (name: string) => this.mappingParam[name];
    },
    visitor: {
      ImportDeclaration(path, state) {
        if (this.ignorePath) return;
        if (
          Helper.getImportPath(path, state) === opt.requestMethodFile &&
          path.node.specifiers[0].type === 'ImportDefaultSpecifier'
        ) {
          this.calleeObjIdentifierName = path.node.specifiers[0].local.name;
        }
      },
      CallExpression(path, state) {
        if (this.ignorePath) return;
        if (
          !!this.calleeObjIdentifierName &&
          (path.node.callee as any)?.object?.name ===
            this.calleeObjIdentifierName
        ) {
          const mybeUrl = path.node.arguments[0];
          if (!!mybeUrl && mybeUrl.type === 'StringLiteral') {
            const obscuredPath = this.mappingPath[mybeUrl.value];
            if (!!obscuredPath) {
              path
                .get('arguments')[0]
                .replaceWith(t.stringLiteral(obscuredPath));
            } else {
              console.warn(`url: ${mybeUrl.value} obscure not founded`);
            }
          }
          return;
        }
        if (
          opt.formInstanceMethod?.length > 0 &&
          path.node.callee.type === 'MemberExpression' &&
          path.node.callee.property.type === 'Identifier' &&
          opt.formInstanceMethod.includes(path.node.callee.property.name) &&
          path.node.arguments[0].type === 'StringLiteral'
        ) {
          if (this.detectParam(path.node.arguments[0].value)) {
            path
              .get('arguments')[0]
              .replaceWith(
                Babel.types.stringLiteral(
                  this.getMappingParmaName(path.node.arguments[0].value)
                )
              );
          }
          return;
        }
      },
      ObjectExpression(path, state) {
        if (this.ignorePath) return;
        if (opt.detectIgnoreObject?.(path)) {
          return;
        }
        path.node.properties.forEach((e, i) => {
          const result = this.detectIsProcessProperty(e);
          if (!!result) {
            path
              .get('properties')
              [i].replaceWith(t.objectProperty(result.key, result.value));
          }
        });
      },
      MemberExpression(path) {
        if (this.ignorePath) return;
        if (
          opt.ignoreObjectName?.length > 0 &&
          path.node.object.type === 'Identifier' &&
          opt.ignoreObjectName.includes(path.node.object.name)
        ) {
          return;
        }
        if (
          path.node.property.type === 'StringLiteral' &&
          this.detectParam(path.node.property.value)
        ) {
          path
            .get('property')
            .replaceWith(
              Babel.types.stringLiteral(
                this.getMappingParmaName(path.node.property.value)
              )
            );
        }
        if (
          path.node.property.type === 'Identifier' &&
          !path.node.computed &&
          this.detectParam(path.node.property.name)
        ) {
          path
            .get('property')
            .replaceWith(
              Babel.types.identifier(
                this.getMappingParmaName(path.node.property.name)
              )
            );
        }
      },
      JSXAttribute(path) {
        if (this.ignorePath) return;
        if (path.node.name.name === 'name') {
          if (path.node.value.type === 'StringLiteral') {
            if (this.detectParam(path.node.value.value)) {
              path
                .get('value')
                .replaceWith(
                  Babel.types.stringLiteral(
                    this.getMappingParmaName(path.node.value.value)
                  )
                );
            }
          } else if (
            path.node.value.type === 'JSXExpressionContainer' &&
            path.node.value.expression.type === 'StringLiteral'
          ) {
            if (this.detectParam(path.node.value.expression.value)) {
              path
                .get('value')
                .replaceWith(
                  Babel.types.stringLiteral(
                    this.getMappingParmaName(path.node.value.expression.value)
                  )
                );
            }
          }
        }
      },
    },
  };
}
