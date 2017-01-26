var isDefined = (x) => { return !!x; }
var isString = (x) => { return typeof x === 'string'; }
var isNode = new Function('try { return this === global; } catch (e) { return false; }');

module.exports = {
  isDefined: isDefined,
  isString: isString,
  isNode: isNode
}