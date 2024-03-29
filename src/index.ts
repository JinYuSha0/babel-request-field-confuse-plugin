import type { PluginObj, PluginPass } from '@babel/core';
import Path from 'path';
import * as Babel from '@babel/core';
import * as Helper from './helper';
import { StringLiteral } from '@babel/types';

interface InputParams {
  srcPath: string;
  blackPath: string[];
  requestMethodFile: string;
  mappingPathFile: string;
  mappingParamFile: string;
  formInstanceMethod: Record<string, number[]>;
  ignoreObjectName: string[];
  JSXAttribute: string[];
  transStrParamFunctionName: string[];
  transMethod: string[];
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
        const relativePath = file.opts.filename.replace(
          Path.join(opt.srcPath, '../'),
          '/'
        );
        try {
          opt.blackPath.forEach(path => {
            if (
              relativePath.startsWith(
                path.replace(Path.join(opt.srcPath, '../'), '')
              )
            ) {
              console.log(`path: ${relativePath} ignore`);
              ignore = true;
              throw new Error();
            }
          });
        } catch (_) {}
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
          path.node.callee.type === 'MemberExpression' &&
          path.node.callee.property.type === 'Identifier' &&
          opt.formInstanceMethod[path.node.callee.property.name]
        ) {
          const argumentList =
            opt.formInstanceMethod[path.node.callee.property.name];
          for (let i = 0; i < path.node.arguments.length; i++) {
            if (
              path.node.arguments[i].type === 'StringLiteral' &&
              this.detectParam(
                (path.node.arguments[i] as StringLiteral).value
              ) &&
              (argumentList.length === 0 || argumentList.includes(i))
            ) {
              path
                .get('arguments')
                [i].replaceWith(
                  Babel.types.stringLiteral(
                    this.getMappingParmaName(
                      (path.node.arguments[i] as StringLiteral).value
                    )
                  )
                );
            }
          }
          return;
        }
        if (
          path.node.callee.type === 'Identifier' &&
          opt.formInstanceMethod[path.node.callee.name]
        ) {
          const argumentList = opt.formInstanceMethod[path.node.callee.name];
          for (let i = 0; i < path.node.arguments.length; i++) {
            if (
              this.detectParam(
                (path.node.arguments[i] as StringLiteral).value
              ) &&
              (argumentList.includes(i) || argumentList.length === 0)
            ) {
              path
                .get('arguments')
                [i].replaceWith(
                  Babel.types.stringLiteral(
                    this.getMappingParmaName(
                      (path.node.arguments[i] as StringLiteral).value
                    )
                  )
                );
            }
          }
        }
        if (
          path.node.callee.type === 'Identifier' &&
          path.node.arguments.length > 0 &&
          path.node.arguments[0].type === 'StringLiteral' &&
          opt.transMethod?.includes(path.node.callee.name)
        ) {
          path
            .get('arguments')[0]
            .replaceWith(
              Babel.types.stringLiteral(
                this.getMappingParmaName(path.node.arguments[0].value) ??
                  path.node.arguments[0].value
              )
            );
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
        if (
          typeof path.node.name.name === 'string' &&
          opt.JSXAttribute.includes(path.node.name.name)
        ) {
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
          } else if (path.node.value.type === 'JSXExpressionContainer') {
            if (path.node.value.expression.type === 'StringLiteral') {
              if (this.detectParam(path.node.value.expression.value)) {
                path
                  .get('value')
                  .replaceWith(
                    Babel.types.stringLiteral(
                      this.getMappingParmaName(path.node.value.expression.value)
                    )
                  );
              }
            } else if (
              path.node.value.expression.type === 'ConditionalExpression'
            ) {
              if (
                this.detectParam(
                  (path.node.value.expression.consequent as any).value
                )
              ) {
                (path.get('value').get('expression') as any)
                  .get('consequent')
                  .replaceWith(
                    Babel.types.stringLiteral(
                      this.getMappingParmaName(
                        (path.node.value.expression.consequent as any).value
                      )
                    )
                  );
              }
              if (
                this.detectParam(
                  (path.node.value.expression.alternate as any).value
                )
              ) {
                (path.get('value').get('expression') as any)
                  .get('alternate')
                  .replaceWith(
                    Babel.types.stringLiteral(
                      this.getMappingParmaName(
                        (path.node.value.expression.alternate as any).value
                      )
                    )
                  );
              }
            }
          }
        }
      },
      ClassDeclaration(path) {
        if (this.ignorePath) return;
        path.node.body.body.forEach((ele, index) => {
          if (
            ele.type === 'ClassMethod' &&
            ele.start &&
            (ele.kind === 'get' || ele.kind === 'set') &&
            ele.key.type === 'Identifier' &&
            !!this.mappingParam[ele.key.name]
          ) {
            (
              path.get('body').get('body')[index].get('key') as Babel.NodePath
            ).replaceWith(
              Babel.types.identifier(this.mappingParam[ele.key.name])
            );
          }
        });
      },
    },
  };
}
