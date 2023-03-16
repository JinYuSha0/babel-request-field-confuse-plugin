"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var Babel = __importStar(require("@babel/core"));
var Helper = __importStar(require("./helper"));
function detectIsProcessProperty(e) {
    var _a;
    if (e.type === 'ObjectProperty') {
        var keyType = e.key.type;
        var key = void 0;
        var name_1;
        if (keyType === 'Identifier') {
            key = 'name';
            name_1 = e.key.name;
        }
        else if (keyType === 'StringLiteral') {
            key = 'value';
            name_1 = e.key.value;
        }
        if (!!this.mappingParam[name_1]) {
            return {
                key: __assign(__assign({}, e.key), (_a = {}, _a[key] = this.mappingParam[name_1], _a)),
                value: e.value,
            };
        }
        return null;
    }
}
function default_1(_a, opt) {
    var t = _a.types;
    return {
        name: 'babel-request-field-confuse-plugin',
        pre: function (file) {
            var _this = this;
            if (!opt.srcPath || !opt.requestMethodFile)
                throw new Error('params error');
            opt.requestMethodFile = Helper.removeFileExtname(opt.requestMethodFile);
            this.underSrc = file.opts.filename.startsWith(opt.srcPath);
            this.calleeObjIdentifierName = '';
            this.mappingPath = Helper.analysePathMapping(Helper.readFile(opt.mappingPathFile));
            this.mappingParam = Helper.analyseParamMapping(Helper.readFile(opt.mappingParamFile));
            this.detectIsProcessProperty = detectIsProcessProperty.bind(this);
            this.detectParam = function (name) { return !!_this.mappingParam[name]; };
            this.getMappingParmaName = function (name) { return _this.mappingParam[name]; };
        },
        visitor: {
            ImportDeclaration: function (path, state) {
                if (this.underSrc &&
                    Helper.getImportPath(path, state) === opt.requestMethodFile &&
                    path.node.specifiers[0].type === 'ImportDefaultSpecifier') {
                    this.calleeObjIdentifierName = path.node.specifiers[0].local.name;
                }
            },
            CallExpression: function (path, state) {
                var _a, _b, _c;
                if (!this.underSrc)
                    return;
                if (!!this.calleeObjIdentifierName &&
                    ((_b = (_a = path.node.callee) === null || _a === void 0 ? void 0 : _a.object) === null || _b === void 0 ? void 0 : _b.name) ===
                        this.calleeObjIdentifierName) {
                    var mybeUrl = path.node.arguments[0];
                    if (!!mybeUrl && mybeUrl.type === 'StringLiteral') {
                        var obscuredPath = this.mappingPath[mybeUrl.value];
                        if (!!obscuredPath) {
                            path
                                .get('arguments')[0]
                                .replaceWith(t.stringLiteral(obscuredPath));
                        }
                        else {
                            console.warn("url: ".concat(mybeUrl.value, " obscure not founded"));
                        }
                    }
                    return;
                }
                if (((_c = opt.formInstanceMethod) === null || _c === void 0 ? void 0 : _c.length) > 0 &&
                    path.node.callee.type === 'MemberExpression' &&
                    path.node.callee.property.type === 'Identifier' &&
                    opt.formInstanceMethod.includes(path.node.callee.property.name) &&
                    path.node.arguments[0].type === 'StringLiteral') {
                    if (this.detectParam(path.node.arguments[0].value)) {
                        path
                            .get('arguments')[0]
                            .replaceWith(Babel.types.stringLiteral(this.getMappingParmaName(path.node.arguments[0].value)));
                    }
                    return;
                }
            },
            ObjectExpression: function (path, state) {
                var _this = this;
                if (!this.underSrc)
                    return;
                path.node.properties.forEach(function (e, i) {
                    var result = _this.detectIsProcessProperty(e);
                    if (!!result) {
                        path
                            .get('properties')[i].replaceWith(t.objectProperty(result.key, result.value));
                    }
                });
            },
            MemberExpression: function (path) {
                var _a;
                if (!this.underSrc)
                    return;
                if (((_a = opt.ignoreObjectName) === null || _a === void 0 ? void 0 : _a.length) > 0 &&
                    path.node.object.type === 'Identifier' &&
                    opt.ignoreObjectName.includes(path.node.object.name)) {
                    return;
                }
                if (path.node.property.type === 'StringLiteral' &&
                    this.detectParam(path.node.property.value)) {
                    path
                        .get('property')
                        .replaceWith(Babel.types.stringLiteral(this.getMappingParmaName(path.node.property.value)));
                }
                if (path.node.property.type === 'Identifier' &&
                    this.detectParam(path.node.property.name)) {
                    path
                        .get('property')
                        .replaceWith(Babel.types.identifier(this.getMappingParmaName(path.node.property.name)));
                }
            },
            JSXAttribute: function (path) {
                if (path.node.name.name === 'name') {
                    if (path.node.value.type === 'StringLiteral') {
                        if (this.detectParam(path.node.value.value)) {
                            path
                                .get('value')
                                .replaceWith(Babel.types.stringLiteral(this.getMappingParmaName(path.node.value.value)));
                        }
                    }
                    else if (path.node.value.type === 'JSXExpressionContainer' &&
                        path.node.value.expression.type === 'StringLiteral') {
                        if (this.detectParam(path.node.value.expression.value)) {
                            path
                                .get('value')
                                .replaceWith(Babel.types.stringLiteral(this.getMappingParmaName(path.node.value.expression.value)));
                        }
                    }
                }
            },
        },
    };
}
exports.default = default_1;
