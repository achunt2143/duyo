(function () {

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	var buildEntry = {};

	var framework = {exports: {}};

	/*jshint node:true */

	/**
	* Returns the global enyo options hash
	* @module enyo/options
	*/

	var options = (commonjsGlobal.enyo && commonjsGlobal.enyo.options) || {};

	(function (module, exports) {

		exports = module.exports = options;
		exports.version = '2.7.0'; 
	} (framework, framework.exports));

	return buildEntry;

})();
