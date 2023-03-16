"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeFileExtname = exports.readFile = exports.analyseParamMapping = exports.analysePathMapping = exports.getImportPath = exports.TEMP = void 0;
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
exports.TEMP = {
    pathMapping: null,
    paramMapping: null,
    keySet: new Set(),
};
function getImportPath(path, state) {
    return path_1.default.join(path_1.default.dirname(state.file.opts.filename), path.node.source.value);
}
exports.getImportPath = getImportPath;
function analysePathMapping(content) {
    if (exports.TEMP.pathMapping)
        return exports.TEMP.pathMapping;
    var result = Object.create(null);
    try {
        content.split('\n').forEach(function (row) {
            var _a = row.match(/mapping path.key=\s*?([^\s]*)\s*?->\s*?value=\s*(.*)/), _ = _a[0], original = _a[1], obscure = _a[2];
            result[original] = obscure;
        });
        exports.TEMP.pathMapping = result;
    }
    catch (_) { }
    return result;
}
exports.analysePathMapping = analysePathMapping;
function analyseParamMapping(content) {
    if (exports.TEMP.paramMapping)
        return exports.TEMP.paramMapping;
    var result = Object.create(null);
    try {
        content.split('\n').forEach(function (row) {
            var _a = row.match(/mapping param.key=\s*?([^\s]*)\s*?->\s*?value=\s*(.*)/), _ = _a[0], original = _a[1], obscure = _a[2];
            result[original] = obscure;
        });
        exports.TEMP.paramMapping = result;
    }
    catch (_) { }
    return result;
}
exports.analyseParamMapping = analyseParamMapping;
function readFile(path) {
    return fs_1.default.readFileSync(path).toString();
}
exports.readFile = readFile;
function removeFileExtname(filename) {
    return filename.replace(path_1.default.extname(filename), '');
}
exports.removeFileExtname = removeFileExtname;
