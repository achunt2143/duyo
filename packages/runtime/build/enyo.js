(function () {

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	var buildEntry = {};

	var utils$a = {};

	(function (exports) {
		/**
		* A collection of utilities
		* @module enyo/utils
		*/

		/**
		* A polyfill for platforms that don't yet support
		* [bind()]{@glossary Function.prototype.bind}. As explained in the linked article, this
		* polyfill handles the general use case but cannot exactly mirror the ECMA-262 version 5
		* implementation specification. This is an adaptation of the example promoted
		* [here]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind}.
		*/
		if (!Function.prototype.bind) {
			Function.prototype.bind = function (ctx) {
				// deliberately used here...
				var args = Array.prototype.slice.call(arguments, 1),
					scop = this,
					nop = function () {},
					ret;

				// as-per MDN's explanation of this polyfill we're filling in for the IsCallable
				// internal (we can't access it)
				if (typeof this != 'function') {
					throw new TypeError('Function.prototype.bind called on non-callable object.');
				}

				ret = function () {
					var largs = args.concat(Array.prototype.slice.call(arguments)),
						lctx = this instanceof nop && ctx ? this : ctx;

					return scop.apply(lctx, largs);
				};

				nop.prototype = this.prototype;

				/*jshint -W055 */
				ret.prototype = new nop();
				/*jshint +W055 */

				return ret;
			};
		}

		/**
		* Returns a function that can be extended (via `.extend()`) similar to prototypal inheritance.
		* Like {@link module:enyo/kind#inherit}, `extend()` expects as its first argument a factory function
		* that returns the new function that will be called instead of the original function. The original
		* is available as the first argument to that factory function.
		*
		* ```javascript
		* var
		*	utils = require('enyo/utils');
		*
		* var factor = new utils.Extensible(function (a, b) {
		*	return a + b;
		* });
		* factor(2, 4); // returns 6;
		* factor.extend(function (sup) {
		*	return function (a, b) {
		*		return sup.apply(this, arguments) * b;
		*	};
		* });
		* factor(2, 4) // return 24;
		* ```
		*
		* @param  {Function} fn - Original function that can be extended
		* @param {Object} [ctx] - Context on which `fn` will be called. Defaults to the Extensible instance.
		* @return {Function} - A wrapped version of `fn` with the `extend()` method added
		*
		* @public
		*/
		exports.Extensible = function Extensible (fn) {
			if (!(this instanceof Extensible)) return new Extensible(fn);

			this.fn = fn;
			var f = function () {
				return this.fn.apply(this, arguments);
			}.bind(this);

			f.extend = function (factory) {
				this.fn = factory(this.fn);
			}.bind(this);

			return f;
		};

		/**
		* @private
		*/
		exports.nop = function () {};

		/**
		* @private
		*/
		exports.nob = {};

		/**
		* @private
		*/
		exports.nar = [];

		/**
		* This name is reported in inspectors as the type of objects created via delegate;
		* otherwise, we would just use {@link module:enyo/utils#nop}.
		*
		* @private
		*/
		var Instance = exports.instance = function () {};

		/**
		* @private
		*/
		var setPrototype = exports.setPrototype = function (ctor, proto) {
			ctor.prototype = proto;
		};

		/**
		* Boodman/crockford delegation w/cornford optimization
		*
		* @private
		*/
		exports.delegate = function (proto) {
			setPrototype(Instance, proto);
			return new Instance();
		};

		// ----------------------------------
		// General Functions
		// ----------------------------------

		/**
		* Determines whether a variable is defined.
		*
		* @param {*} target - Anything that can be compared to `undefined`.
		* @returns {Boolean} `true` if defined, `false` otherwise.
		* @public
		*/
		var exists = exports.exists = function (target) {
			return (target !== undefined);
		};

		var uidCounter = 0;

		/**
		* Creates a unique identifier (with an optional prefix) and returns the identifier as a string.
		*
		* @param {String} [prefix] - The prefix to prepend to the generated unique id.
		* @returns {String} An optionally-prefixed identifier.
		* @public
		*/
		exports.uid = function (prefix) {
			return String((prefix? prefix: '') + uidCounter++);
		};

		/**
		* RFC4122 uuid generator for the browser.
		*
		* @returns {String} An [RFC4122]{@glossary UUID}-compliant, universally unique identifier.
		* @public
		*/
		exports.uuid = function () {
			// @TODO: Could possibly be faster
			var t, p = (
				(Math.random().toString(16).substr(2,8)) + '-' +
				((t=Math.random().toString(16).substr(2,8)).substr(0,4)) + '-' +
				(t.substr(4,4)) +
				((t=Math.random().toString(16).substr(2,8)).substr(0,4)) + '-' +
				(t.substr(4,4)) +
				(Math.random().toString(16).substr(2,8))
			);
			return p;
		};

		/**
		* Generates a random number using [Math.random]{@glossary Math.random}.
		*
		* @param {Number} bound - The multiplier used to generate the product.
		* @returns {Number} A random number.
		* @public
		*/
		exports.irand = function (bound) {
			return Math.floor(Math.random() * bound);
		};

		var toString = Object.prototype.toString;

		/**
		* Determines whether a given variable is a [String]{@glossary String}.
		*
		* @param {*} it - The variable to be tested.
		* @returns {Boolean} `true` if variable is a [String]{@glossary String};
		* otherwise, `false`.
		* @public
		*/
		exports.isString = function (it) {
			return toString.call(it) === '[object String]';
		};

		/**
		* Determines whether a given variable is a [Function]{@glossary Function}.
		*
		* @param {*} it - The variable to be tested.
		* @returns {Boolean} `true` if variable is a [Function]{@glossary Function};
		* otherwise, `false`.
		* @public
		*/
		exports.isFunction = function (it) {
			return toString.call(it) === '[object Function]';
		};

		/**
		* Determines whether a given variable is an [Array]{@glossary Array}.
		*
		* @param {*} it - The variable to be tested.
		* @returns {Boolean} `true` if variable is an [Array]{@glossary Array};
		* otherwise, `false`.
		* @method
		* @public
		*/
		var isArray = exports.isArray = Array.isArray || function (it) {
			return toString.call(it) === '[object Array]';
		};

		/**
		* Determines whether a given variable is an [Object]{@glossary Object}.
		*
		* @param {*} it - The variable to be tested.
		* @returns {Boolean} `true` if variable is an [Object]{@glossary Object};
		* otherwise, `false`.
		* @method
		* @public
		*/
		exports.isObject = Object.isObject || function (it) {
			return toString.call(it) === '[object Object]';
		};

		/**
		* Determines whether a given variable is an explicit boolean `true`.
		*
		* @param {*} it - The variable to be tested.
		* @returns {Boolean} `true` if variable is an explicit `true`; otherwise,
		* `false`.
		* @public
		*/
		exports.isTrue = function (it) {
			return !(it === 'false' || it === false || it === 0 || it === null || it === undefined);
		};

		/**
		* Determines whether a given variable is a numeric value.
		*
		* @param {*} it - The variable to be tested.
		* @returns {Boolean} `true` if variable is a numeric value; otherwise,
		* `false`.
		* @public
		*/
		exports.isNumeric = function (it) {
			// borrowed from jQuery
			return !isArray(it) && (it - parseFloat(it) + 1) >= 0;
		};

		/**
		* Binds the `this` context of any method to a scope and a variable number of provided initial
		* parameters.
		*
		* @param {Object} scope - The `this` context for the method.
		* @param {(Function|String)} method - A Function or the name of a method to bind.
		* @param {...*} [args] Any arguments that will be provided as the initial arguments to the
		*                      enclosed method.
		* @returns {Function} The bound method/closure.
		* @public
		*/
		var bind = exports.bind = function (scope, method) {
			if (!method) {
				method = scope;
				scope = null;
			}
			scope = scope || commonjsGlobal;
			if (typeof method == 'string') {
				if (scope[method]) {
					method = scope[method];
				} else {
					throw('enyo.bind: scope["' + method + '"] is null (scope="' + scope + '")');
				}
			}
			if (typeof method == 'function') {
				var args = cloneArray(arguments, 2);
				if (method.bind) {
					return method.bind.apply(method, [scope].concat(args));
				} else {
					return function() {
						var nargs = cloneArray(arguments);
						// invoke with collected args
						return method.apply(scope, args.concat(nargs));
					};
				}
			} else {
				throw('enyo.bind: scope["' + method + '"] is not a function (scope="' + scope + '")');
			}
		};

		/**
		* Binds a callback to a scope. If the object has a `destroyed` property that's truthy, then the
		* callback will not be run if called. This can be used to implement both
		* {@link module:enyo/CoreObject~Object#bindSafely} and {@link module:enyo/CoreObject~Object}-like objects like
		* {@link module:enyo/Model~Model} and {@link module:enyo/Collection~Collection}.
		*
		* @param {Object} scope - The `this` context for the method.
		* @param {(Function|String)} method - A Function or the name of a method to bind.
		* @param {...*} [args] Any arguments that will be provided as the initial arguments to the
		*                      enclosed method.
		* @returns {Function} The bound method/closure.
		* @public
		*/
		exports.bindSafely = function (scope, method) {
			if (typeof method == 'string') {
				if (scope[method]) {
					method = scope[method];
				} else {
					throw('enyo.bindSafely: scope["' + method + '"] is null (this="' + this + '")');
				}
			}
			if (typeof method == 'function') {
				var args = cloneArray(arguments, 2);
				return function() {
					if (scope.destroyed) {
						return;
					}
					var nargs = cloneArray(arguments);
					return method.apply(scope, args.concat(nargs));
				};
			} else {
				throw('enyo.bindSafely: scope["' + method + '"] is not a function (this="' + this + '")');
			}
		};

		/**
		* Calls the provided `method` on `scope`, asynchronously.
		*
		* Uses [window.setTimeout()]{@glossary window.setTimeout} with minimum delay,
		* usually around 10ms.
		*
		* Additional arguments are passed to `method` when it is invoked.
		*
		* If only a single argument is supplied, will just call that function asynchronously without
		* doing any additional binding.
		*
		* @param {Object} scope - The `this` context for the method.
		* @param {(Function|String)} method - A Function or the name of a method to bind.
		* @param {...*} [args] Any arguments that will be provided as the initial arguments to the
		*                      enclosed method.
		* @returns {Number} The `setTimeout` id.
		* @public
		*/
		exports.asyncMethod = function (scope, method) {
			if (!method) {
				// passed just a single argument
				return setTimeout(scope, 1);
			} else {
				return setTimeout(bind.apply(scope, arguments), 1);
			}
		};

		/**
		* Calls the provided `method` ([String]{@glossary String}) on `scope` with optional
		* arguments `args` ([Array]{@glossary Array}), if the object and method exist.
		*
		* @example
		* 	utils = require('enyo/utils');
		* 	utils.call(myWorkObject, 'doWork', [3, 'foo']);
		*
		* @param {Object} scope - The `this` context for the method.
		* @param {(Function|String)} method - A Function or the name of a method to bind.
		* @param {Array} [args] - An array of arguments to pass to the method.
		* @returns {*} The return value of the method.
		* @public
		*/
		exports.call = function (scope, method, args) {
			var context = scope || this;
			if (method) {
				var fn = context[method] || method;
				if (fn && fn.apply) {
					return fn.apply(context, args || []);
				}
			}
		};

		/**
		* Returns the current time in milliseconds. On platforms that support it,
		* [Date.now()]{@glossary Date.now} will be used; otherwise this will
		* be equivalent to [new Date().getTime()]{@glossary Date.getTime}.
		*
		* @returns {Number} Number of milliseconds representing the current time.
		* @method
		* @public
		*/

		var now = exports.now = Date.now || function () {
			return new Date().getTime();
		};

		/**
		* When [window.performance]{@glossary window.performance} is available, supplies
		* a high-precision, high-performance monotonic timestamp, which is independent of
		* changes to the system clock and thus safer for use in animation, etc. Falls back to
		* {@link module:enyo/utils#now} (based on the JavaScript [Date]{@glossary Date} object),
		* which is subject to system time changes.
		*
		* @returns {Number} Number of milliseconds representing the current time or time since
		*                   start of application execution as reported by the platform.
		* @method
		* @public
		*/
		exports.perfNow = (function () {
			// we have to check whether or not the browser has supplied a valid
			// method to use
			var perf = window.performance || {};
			// test against all known vendor-specific implementations, but use
			// a fallback just in case
			perf.now = perf.now || perf.mozNow || perf.msNow || perf.oNow || perf.webkitNow || now;
			return function () {
				return perf.now();
			};
		}());

		/**
		* A fast-path enabled global getter that takes a string path, which may be a full path (from
		* context window/Enyo) or a relative path (to the execution context of the method). It knows how
		* to check for and call the backwards-compatible generated getters, as well as how to handle
		* computed properties. Returns `undefined` if the object at the given path cannot be found. May
		* safely be called on non-existent paths.
		*
		* @param {String} path - The path from which to retrieve a value.
		* @returns {*} The value for the given path, or `undefined` if the path could not be
		*                  completely resolved.
		* @method enyo.getPath
		* @public
		*/
		var getPath = exports.getPath = function (path) {
			// we're trying to catch only null/undefined not empty string or 0 cases
			if (!path && path !== null && path !== undefined) return path;

			var next = this,
				parts,
				part,
				getter;

			// obviously there is a severe penalty for requesting get with a path lead
			// by unnecessary relative notation...
			if (path[0] == '.') path = path.replace(/^\.+/, '');

			// here's where we check to make sure we have a truthy string-ish
			if (!path) return;

			parts = path.split('.');
			part = parts.shift();

			do {
				// for constructors we must check to make sure they are undeferred before
				// looking for static properties
				// for the auto generated or provided published property support we have separate
				// routines that must be called to preserve compatibility
				if (next._getters && ((getter = next._getters[part])) && !getter.generated) next = next[getter]();
				// for all other special cases to ensure we use any overloaded getter methods
				else if (next.get && next !== this && next.get !== getPath) next = next.get(part);
				// and for regular cases
				else next = next[part];
			} while (next && (part = parts.shift()));

			// if necessary we ensure we've undeferred any constructor that we're
			// retrieving here as a final property as well
			return next;
		};

		/**
		* @private
		*/
		getPath.fast = function (path) {
			// the current context
			var b = this, fn, v;
			if (b._getters && (fn = b._getters[path])) {
				v = b[fn]();
			} else {
				v = b[path];
			}

			return v;
		};

		/**
		* @TODO: Out of date...
		* A global setter that takes a string path (relative to the method's execution context) or a
		* full path (relative to window). Attempts to automatically retrieve any previously existing
		* value to supply to any observers. If the context is an {@link module:enyo/CoreObject~Object} or subkind, the
		* {@link module:enyo/ObserverSupport~ObserverSupport.notify} method is used to notify listeners for the path's being
		* set. If the previous value is equivalent to the newly set value, observers will not be
		* triggered by default. If the third parameter is present and is an explicit boolean true, the
		* observers will be triggered regardless. Returns the context from which the method was executed.
		*
		* @param {String} path - The path for which to set the given value.
		* @param {*} is - The value to set.
		* @param {Object} [opts] - An options hash.
		* @returns {this} Whatever the given context was when executed.
		* @method enyo.setPath
		* @public
		*/
		var setPath = exports.setPath = function (path, is, opts) {
			// we're trying to catch only null/undefined not empty string or 0 cases
			if (!path || (!path && path !== null && path !== undefined)) return this;

			var next = this,
				options = {create: true, silent: false, force: false},
				base = next,
				parts,
				part,
				was,
				force,
				create,
				silent,
				comparator;

			if (typeof opts == 'object') opts = mixin({}, [options, opts]);
			else {
				force = opts;
				opts = options;
			}

			if (opts.force) force = true;
			silent = opts.silent;
			create = opts.create;
			comparator = opts.comparator;


			// obviously there is a severe penalty for requesting get with a path lead
			// by unnecessary relative notation...
			if (path[0] == '.') path = path.replace(/^\.+/, '');

			// here's where we check to make sure we have a truthy string-ish
			if (!path) return next;

			parts = path.split('.');
			part = parts.shift();

			do {

				if (!parts.length) was = next.get && next.get !== getPath? next.get(part): next[part];
				else {
					// this allows us to ensure that if we're setting a static property of a constructor we have the
					// correct constructor
					// @TODO: It seems ludicrous to have to check this on every single part of a chain; if we didn't have
					// deferred constructors this wouldn't be necessary and is expensive - unnecessarily so when speed is so important
					if (next !== base && next.set && next.set !== setPath) {
						parts.unshift(part);
						next.set(parts.join('.'), is, opts);
						return base;
					}
					if (next !== base && next.get) next = (next.get !== getPath? next.get(part): next[part]) || (create && (next[part] = {}));
					else next = next[part] || (create && (next[part] = {}));
				}

			} while (next && parts.length && (part = parts.shift()));

			if (!next) return base;

			// now update to the new value
			if (next !== base && next.set && next.set !== setPath) {
				next.set(part, is, opts);
				return base;
			} else next[part] = is;

			// if possible we notify the changes but this change is notified from the immediate
			// parent not the root object (could be the same)
			if (next.notify && !silent && (force || was !== is || (comparator && comparator(was, is)))) next.notify(part, was, is, opts);
			// we will always return the original root-object of the call
			return base;
		};

		/**
		* @private
		*/
		setPath.fast = function (path, value) {
			// the current context
			var b = this,
				// the previous value and helper variable
				rv, fn;
			// we have to check and ensure that we're not setting a computed property
			// and if we are, do nothing
			if (b._computed && b._computed[path] !== undefined) {
				return b;
			}
			if (b._getters && (fn=b._getters[path])) {
				rv = b[fn]();
			} else {
				rv = b[path];
			}
			// set the new value now that we can
			b[path] = value;

			// this method is only ever called from the context of enyo objects
			// as a protected method
			if (rv !== value) { b.notifyObservers(path, rv, value); }
			// return the context
			return b;
		};

		// ----------------------------------
		// String Functions
		// ----------------------------------

		/**
		* Uppercases a given string. Will coerce to a [String]{@glossary String}
		* if possible/necessary.
		*
		* @param {String} str - The string to uppercase.
		* @returns {String} The uppercased string.
		* @public
		*/
		exports.toUpperCase = new exports.Extensible(function (str) {
			if (str != null) {
				return str.toString().toUpperCase();
			}
			return str;
		});

		/**
		* Lowercases a given string. Will coerce to a [String]{@glossary String}
		* if possible/necessary.
		*
		* @param {String} str - The string to lowercase.
		* @returns {String} The lowercased string.
		* @public
		*/
		exports.toLowerCase = new exports.Extensible(function (str) {
			if (str != null) {
				return str.toString().toLowerCase();
			}
			return str;
		});

		/**
		* Capitalizes a given string.
		*
		* @param {String} str - The string to capitalize.
		* @returns {String} The capitalized string.
		* @public
		*/
		exports.cap = function (str) {
			return str.slice(0, 1).toUpperCase() + str.slice(1);
		};

		/**
		* Un-capitalizes a given string.
		*
		* @param {String} str - The string to un-capitalize.
		* @returns {String} The un-capitalized string.
		* @public
		*/
		exports.uncap = function (str) {
			return str.slice(0, 1).toLowerCase() + str.slice(1);
		};

		/**
		* Injects an arbitrary number of values, in order, into a template string at
		* positions marked by `"%."`.
		*
		* @param {String} template - The string template to inject with values.
		* @param {...String} val The values to inject into the template.
		* @returns {String} A copy of the template populated with values.
		* @public
		*/
		exports.format = function (template) {
			var pattern = /\%./g,
				arg = 0,
				tmp = template,
				args = arguments,
				replacer;

			replacer = function () {
				return args[++arg];
			};

			return tmp.replace(pattern, replacer);
		};

		/**
		* @private
		*/
		String.prototype.trim = String.prototype.trim || function () {
			return this.replace(/^\s+|\s+$/g, '');
		};

		/**
		* Takes a string and trims leading and trailing spaces. Strings with no length,
		* non-strings, and falsy values will be returned without modification.
		*
		* @param {String} str - The string from which to remove whitespace.
		* @returns {String} The trimmed string.
		* @public
		*/
		exports.trim = function (str) {
			return (typeof str == 'string' && str.trim()) || str;
		};

		// ----------------------------------
		// Object Functions
		// ----------------------------------

		/**
		* A [polyfill]{@glossary polyfill} for platforms that don't support
		* [Object.create()]{@glossary Object.create}.
		*/
		Object.create = Object.create || (function () {
			var Anon = function () {};
			return function (obj) {
				// in the polyfill we can't support the additional features so we are ignoring
				// the extra parameters
				if (!obj || obj === null || typeof obj != 'object') throw 'Object.create: Invalid parameter';
				Anon.prototype = obj;
				return new Anon();
			};
		})();

		/**
		* A [polyfill]{@glossary polyfill} for platforms that don't support
		* [Object.keys()]{@glossary Object.keys}.
		*/
		Object.keys = Object.keys || function (obj) {
			var results = [];
			var hop = Object.prototype.hasOwnProperty;
			for (var prop in obj) {
				if (hop.call(obj, prop)) {
					results.push(prop);
				}
			}
			return results;
		};

		/**
		* Returns an array of all known enumerable properties found on a given object.
		*
		* @alias Object.keys.
		* @method enyo.keys
		* @public
		*/
		exports.keys = Object.keys;

		/**
		* Convenience method that takes an [array]{@glossary Array} of properties
		* and an [object]{@glossary Object} as parameters. Returns a new object
		* with only those properties named in the array that are found to exist on the
		* base object. If the third parameter is `true`, falsy values will be ignored.
		*
		* @param {String[]} properties The properties to include on the returned object.
		* @param {Object} object - The object from which to retrieve values for the requested properties.
		* @param {Boolean} [ignore=false] Whether or not to ignore copying falsy values.
		* @returns {Object} A new object populated with the requested properties and values from
		*                     the given object.
		* @public
		*/
		exports.only = function (properties, object, ignore) {
			var ret = {},
				prop,
				len,
				i;

			for (i = 0, len = properties.length >>> 0; i < len; ++i) {
				prop = properties[i];

				if (ignore && (object[prop] === undefined || object[prop] === null)) continue;
				ret[prop] = object[prop];
			}

			return ret;
		};

		/**
		* Convenience method that takes two [objects]{@glossary Object} as parameters.
		* For each key from the first object, if the key also exists in the second object,
		* a mapping of the key from the first object to the key from the second object is
		* added to a result object, which is eventually returned. In other words, the
		* returned object maps the named properties of the first object to the named
		* properties of the second object. The optional third parameter is a boolean
		* designating whether to pass unknown key/value pairs through to the new object.
		* If `true`, those keys will exist on the returned object.
		*
		* @param {Object} map - The object with key/value pairs.
		* @param {Object} obj - The object whose values will be used.
		* @param {Boolean} [pass=false] Whether or not to pass unnamed properties through
		*                               from the given object.
		* @returns {Object} A new object whose properties have been mapped.
		* @public
		*/
		exports.remap = function (map, obj, pass) {
			var ret = pass ? clone(obj) : {},
				key;

			for (key in map) {
				if (key in obj) ret[map[key]] = obj.get ? obj.get(key) : obj[key];
			}
			return ret;
		};

		/**
		* Helper method that accepts an [array]{@glossary Array} of
		* [objects]{@glossary Object} and returns a hash of those objects indexed
		* by the specified `property`. If a `filter` is provided, the filter should
		* accept four parameters: the key, the value (object), the current mutable map
		* reference, and an immutable copy of the original array of objects for
		* comparison.
		*
		* @param {String} property - The property to index the array by.
		* @param {Array} array - An array of property objects.
		* @param {Function} [filter] - The filter function to use; accepts four arguments.
		* @returns {Object} A hash (object) indexed by the `property` argument
		* @public
		*/
		exports.indexBy = function (property, array, filter) {
			// the return value - indexed map from the given array
			var map = {},
				value,
				len,
				idx = 0;
			// sanity check for the array with an efficient native array check
			if (!exists(array) || !(array instanceof Array)) {
				return map;
			}
			// sanity check the property as a string
			if (!exists(property) || 'string' !== typeof property) {
				return map;
			}
			// the immutable copy of the array
			var copy = clone(array);
			// test to see if filter actually exsits
			filter = exists(filter) && 'function' === typeof filter ? filter : undefined;
			for (len = array.length; idx < len; ++idx) {
				// grab the value from the array
				value = array[idx];
				// make sure that it exists and has the requested property at all
				if (exists(value) && exists(value[property])) {
					if (filter) {
						// if there was a filter use it - it is responsible for
						// updating the map accordingly
						filter(property, value, map, copy);
					} else {
						// use the default behavior - check to see if the key
						// already exists on the map it will be overwritten
						map[value[property]] = value;
					}
				}
			}
			// go ahead and return our modified map
			return map;
		};

		/**
		* Creates and returns a shallow copy of an [Object]{@glossary Object} or an
		* [Array]{@glossary Array}. For objects, by default, properties will be scanned and
		* copied directly to the clone such that they would pass the
		* [hasOwnProperty()]{@glossary Object.hasOwnProperty} test. This is expensive and often not
		* required. In this case, the optional second parameter may be used to allow a more efficient
		* [copy]{@link Object.create} to be made.
		*
		* @param {(Object|Array)} base - The [Object]{@glossary Object} or
		*                              [Array]{@glossary Array} to be cloned.
		* @param {Boolean} [quick] - If `true`, when cloning objects, a faster [copy]{@link Object.create}
		*                          method will be used. This parameter has no meaning when cloning arrays.
		* @returns {*} A clone of the provided `base` if `base` is of the correct type; otherwise,
		*              returns `base` as it was passed in.
		* @public
		*/
		var clone = exports.clone = function (base, quick) {
			if (base) {

				// avoid the overhead of calling yet another internal function to do type-checking
				// just copy the array and be done with it
				if (base instanceof Array) return base.slice();
				else if (base instanceof Object) {
					return quick ? Object.create(base) : mixin({}, base);
				}
			}

			// we will only do this if it is not an array or native object
			return base;
		};

		var empty = {};
		var mixinDefaults = {
			exists: false,
			ignore: false,
			filter: null
		};

		/**
			@todo Rewrite with appropriate documentation for options parameter (typedef)
			@todo document 'quick' option

			Will take a variety of options to ultimately mix a set of properties
			from objects into single object. All configurations accept a boolean as
			the final parameter to indicate whether or not to ignore _truthy_/_existing_
			values on any _objects_ prior.

			If _target_ exists and is an object, it will be the base for all properties
			and the returned value. If the parameter is used but is _falsy_, a new
			object will be created and returned. If no such parameter exists, the first
			parameter must be an array of objects and a new object will be created as
			the _target_.

			The _source_ parameter may be an object or an array of objects. If no
			_target_ parameter is provided, _source_ must be an array of objects.

			The _options_ parameter allows you to set the _ignore_ and/or _exists_ flags
			such that if _ignore_ is true, it will not override any truthy values in the
			target, and if _exists_ is true, it will only use truthy values from any of
			the sources. You may optionally add a _filter_ method-option that returns a
			true or false value to indicate whether the value should be used. It receives
			parameters in this order: _property_, _source value_, _source values_,
			_target_, _options_. Note that modifying the target in the filter method can
			have unexpected results.

			Setting _options_ to true will set all options to true.

		* @method enyo.mixin
		* @public
		*/
		var mixin = exports.mixin = function () {
			var ret = arguments[0],
				src = arguments[1],
				opts = arguments[2],
				val;

			if (!ret) ret = {};
			else if (ret instanceof Array) {
				opts = src;
				src = ret;
				ret = {};
			}

			if (!opts || opts === true) opts = mixinDefaults;

			if (src instanceof Array) for (var i=0, it; (it=src[i]); ++i) mixin(ret, it, opts);
			else {
				for (var key in src) {
					val = src[key];

					// quickly ensure the property isn't a default
					if (empty[key] !== val) {
						if (
							(!opts.exists || val) &&
							(!opts.ignore || !ret[key]) &&
							(opts.filter? opts.filter(key, val, src, ret, opts): true)
						) {
							ret[key] = val;
						}
					}
				}
			}

			return ret;
		};

		/**
		* Returns an [array]{@glossary Array} of the values of all properties in an
		* [object]{@glossary Object}.
		*
		* @param {Object} obj - The [Object]{@glossary Object} to read the values from.
		* @returns {Array} An [array]{@glossary Array} with the values from the `obj`.
		* @public
		*/
		exports.values = function (obj) {
			var ret = [];
			for (var key in obj) {
				if (obj.hasOwnProperty(key)) ret.push(obj[key]);
			}
			return ret;
		};

		// ----------------------------------
		// Array Functions
		// ----------------------------------

		/**
		* A [polyfill]{@glossary polyfill} for platforms that don't support
		* [Array.findIndex()]{@glossary Array.findIndex}.
		*/
		Array.prototype.findIndex = Array.prototype.findIndex || function (fn, ctx) {
			for (var i=0, len=this.length >>> 0; i<len; ++i) {
				if (fn.call(ctx, this[i], i, this)) return i;
			}
			return -1;
		};

		/**
		* A [polyfill]{@glossary polyfill} for platforms that don't support
		* [Array.find()]{@glossary Array.find}.
		*/
		Array.prototype.find = Array.prototype.find || function (fn, ctx) {
			for (var i=0, len=this.length >>> 0; i<len; ++i) {
				if (fn.call(ctx, this[i], i, this)) return this[i];
			}
		};

		/**
		* An Enyo convenience method reference to [Array.indexOf()]{@glossary Array.indexOf}.
		*
		* This also supports the legacy Enyo argument order `el.indexOf(array, offset)` and can
		* differentiate between this and the standard `array.indexOf(el, offset)`.
		*
		* **When possible, you should use the native equivalent.**
		*
		* This method supports the same arguments as the native version, plus an extra argument at the
		* beginning referring to the [array]{@glossary Array} to run this method on.
		*
		* @public
		*/
		exports.indexOf = function (array, el, offset) {
			if (!(array instanceof Array)) return el.indexOf(array, offset);
			return array.indexOf(el, offset);
		};

		/**
		* An Enyo convenience method reference to [Array.lastIndexOf()]{@glossary Array.lastIndexOf}.
		*
		* This also supports the legacy Enyo argument order `el.lastIndexOf(array, offset)` and can
		* differentiate between this and the standard `array.lastIndexOf(el, offset)`.
		*
		* **When possible, you should use the native equivalent.**
		*
		* This method supports the same arguments as the native version, plus an extra argument at the
		* beginning referring to the [array]{@glossary Array} to run this method on.
		*
		* @public
		*/
		exports.lastIndexOf = function (array, el, offset) {
			if (!(array instanceof Array)) return el.lastIndexOf(array, offset);
			return array.lastIndexOf(el, offset);
		};

		/**
		* An Enyo convenience method reference to [Array.findIndex()]{@glossary Array.findIndex}.
		*
		* **When possible, you should use the native equivalent.**
		*
		* This method supports the same arguments as the native version, plus an extra argument at the
		* beginning referring to the [array]{@glossary Array} to run this method on.
		*
		* @public
		*/
		exports.findIndex = function (array, fn, ctx) {
			return array.findIndex(fn, ctx);
		};

		/**
		* An Enyo convenience method reference to [Array.find()]{@glossary Array.find}.
		*
		* **When possible, you should use the native equivalent.**
		*
		* This method supports the same arguments as the native version, plus an extra argument at the
		* beginning referring to the [array]{@glossary Array} to run this method on.
		*
		* @method enyo.find
		* @public
		*/
		var find = exports.find = function (array, fn, ctx) {
			return array.find(fn, ctx);
		};

		/**
		* @alias enyo.find
		* @method enyo.where
		* @public
		*/
		exports.where = find;

		/**
		* An Enyo convenience method reference to [Array.forEach()]{@glossary Array.forEach}.
		*
		* **When possible, you should use the native equivalent.**
		*
		* This method supports the same arguments as the native version, plus an extra argument at the
		* beginning referring to the [array]{@glossary Array} to run this method on.
		*
		* @public
		*/
		exports.forEach = function (array, fn, ctx) {
			return array.forEach(fn, ctx);
		};

		/**
		* An Enyo convenience method reference to [Array.map()]{@glossary Array.map}.
		*
		* **When possible, you should use the native equivalent.**
		*
		* This method supports the same arguments as the native version, plus an extra argument at the
		* beginning referring to the [array]{@glossary Array} to run this method on.
		*
		* @public
		*/
		exports.map = function (array, fn, ctx) {
			return array.map(fn, ctx);
		};

		/**
		* An Enyo convenience method reference to [Array.filter()]{@glossary Array.filter}.
		*
		* **When possible, you should use the native equivalent.**
		*
		* This method supports the same arguments as the native version, plus an extra argument at the
		* beginning referring to the [array]{@glossary Array} to run this method on.
		*
		* @public
		*/
		exports.filter = function (array, fn, ctx) {
			return array.filter(fn, ctx);
		};

		/**
		* When given an [array]{@glossary Array} of [objects]{@glossary Object},
		* searches through the array's objects; each object with a property name matching
		* `prop` has its value for that property compiled into a result array, which is
		* eventually returned. For each array object that doesn't have a matching property,
		* an `undefined` placeholder element is added to the result array, such that the
		* returned result array has the same length as the passed-in `array` parameter.
		*
		* @param {Array} array - The [array]{@glossary Array} of [objects]{@glossary Object}
		*                      in which the `prop` will be searched for.
		* @param {String} prop - A string containing the name of the property to search for.
		* @returns {Array} An array of all the values of the named property from
		*                     objects contained in the `array`.
		* @public
		*/
		exports.pluck = function (array, prop) {
			if (!(array instanceof Array)) {
				var tmp = array;
				array = prop;
				prop = tmp;
			}

			var ret = [];
			for (var i=0, len=array.length >>> 0; i<len; ++i) {
				ret.push(array[i]? array[i][prop]: undefined);
			}
			return ret;
		};

		/**
		* Concatenates a variable number of [arrays]{@glossary Array}, removing any duplicate
		* entries.
		*
		* @returns {Array} The unique values from all [arrays]{@glossary Array}.
		* @public
		*/
		exports.merge = function (/* _arrays_ */) {
			var ret = [],
				values = Array.prototype.concat.apply([], arguments);
			for (var i=0, len=values.length >>> 0; i<len; ++i) {
				if (!~ret.indexOf(values[i])) ret.push(values[i]);
			}
			return ret;
		};

		/**
		* Clones an existing [Array]{@glossary Array}, or converts an array-like
		* object into an Array.
		*
		* If `offset` is non-zero, the cloning starts from that index in the source
		* Array. The clone may be appended to an existing Array by passing in the
		* existing Array as `initialArray`.
		*
		* Array-like objects have `length` properties, and support square-bracket
		* notation `([])`. Array-like objects often do not support Array methods
		* such as `push()` or `concat()`, and so must be converted to Arrays before
		* use.
		*
		* The special `arguments` variable is an example of an array-like object.
		*
		* @public
		*/
		var cloneArray = exports.cloneArray = function (array, offset, initialArray) {
			var ret = initialArray || [];
			for(var i = offset || 0, l = array.length; i<l; i++){
				ret.push(array[i]);
			}
			// Alternate smarter implementation:
			// return Array.prototype.slice.call(array, offset);
			// Array.of
			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of
			return ret;
		};

		/**
		* @alias cloneArray
		* @method enyo.toArray
		* @public
		*/
		exports.toArray = cloneArray;

		/**
		* Within a given [array]{@glossary Array}, removes the first
		* [strictly equal to]{@glossary ===} occurrence of `el`.
		* Note that `array` is modified directly.
		*
		* @param {Array} array - The [Array]{@glossary Array} to look through.
		* @param {*} el - The element to search for and remove.
		* @public
		*/
		exports.remove = function (array, el) {
			if (!(array instanceof Array)) {
				var tmp = array;
				array = el;
				el = tmp;
			}

			var i = array.indexOf(el);
			if (-1 < i) array.splice(i, 1);
			return array;
		};

		/**
		* This regex pattern is used by the [isRtl()]{@link module:enyo/utils#isRtl} function.
		*
		* Arabic: \u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFE
		* Hebrew: \u0590-\u05FF\uFB1D-\uFB4F
		*
		* @private
		*/
		var rtlPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFE\u0590-\u05FF\uFB1D-\uFB4F]/;

		/**
		* Takes content `str` and determines whether or not it is [RTL]{@glossary RTL}.
		*
		* @param {String} str - A [String]{@glossary String} to check the [RTL]{@glossary RTL}-ness of.
		* @return {Boolean} `true` if `str` should be RTL; `false` if not.
		* @public
		*/
		exports.isRtl = function (str) {
			return rtlPattern.test(str);
		}; 
	} (utils$a));

	var Component$3 = {exports: {}};

	var kind$e = {exports: {}};

	var logger$3 = {exports: {}};

	/**
	* [JSON]{@glossary JSON} related methods and wrappers.
	*
	* @module enyo/json
	* @public
	*/
	var json = {
		
		/**
		* Wrapper for [JSON.stringify()]{@glossary JSON.stringify}. Creates a
		* [JSON]{@glossary JSON} [string]{@glossary String} from an
		* [object]{@glossary Object}.
		*
		* @see {@glossary JSON.stringify}
		* @param {Object} value - The [object]{@glossary Object} to convert to a
		*	[JSON]{@glossary JSON} [string]{@glossary String}.
		* @param {(Function|String[])} [replacer] An optional parameter indicating either an
		*	[array]{@glossary Array} of keys to include in the final output or a
		*	[function]{@glossary Function} that will have the opportunity to dynamically return
		*	values to include for keys.
		* @param {(Number|String)} [space] - Determines the spacing (if any) for pretty-printed
		*	output of the JSON string. A [number]{@glossary Number} indicates the number of
		* spaces to use in the output, while a string will be used verbatim.
		* @returns {String} The JSON string for the given object.
		* @public
		*/
		stringify: function(value, replacer, space) {
			return JSON.stringify(value, replacer, space);
		},
		
		/**
		* Wrapper for [JSON.parse()]{@glossary JSON.parse}. Parses a valid
		* [JSON]{@glossary JSON} [string]{@glossary String} and returns an
		* [object]{@glossary Object}, or `null` if the parameters are invalid.
		*
		* @see {@glossary JSON.parse}
		* @param {String} json - The [JSON]{@glossary JSON} [string]{@glossary String} to
		*	parse into an [object]{@glossary Object}.
		* @param {Function} [reviver] - The optional [function]{@glossary Function} to use to
		*	parse individual keys of the return object.
		* @returns {(Object|null)} If parameters are valid, an [object]{@glossary Object}
		* is returned; otherwise, `null`.
		* @public
		*/
		parse: function(json, reviver) {
			return json ? JSON.parse(json, reviver) : null;
		}
	};

	var platform = {exports: {}};

	(function (module, exports) {
		var utils = utils$a;

		/**
		* Determines OS versions of platforms that need special treatment. Can have one of the following
		* properties:
		*
		* * android
		* * androidChrome (Chrome on Android, standard starting in 4.1)
		* * androidFirefox
		* * ie
		* * edge
		* * ios
		* * webos
		* * windowsPhone
		* * blackberry
		* * tizen
		* * safari (desktop version)
		* * chrome (desktop version)
		* * firefox (desktop version)
		* * firefoxOS
		*
		* If the property is defined, its value will be the major version number of the platform.
		*
		* Example:
		* ```javascript
		* // android 2 does not have 3d css
		* if (enyo.platform.android < 3) {
		* 	t = 'translate(30px, 50px)';
		* } else {
		* 	t = 'translate3d(30px, 50px, 0)';
		* }
		* this.applyStyle('-webkit-transform', t);
		* ```
		*
		* @module enyo/platform
		*/
		exports = module.exports = {
			/**
			* `true` if the platform has native single-finger [events]{@glossary event}.
			* @public
			*/
			touch: Boolean(('ontouchstart' in window) || window.navigator.msMaxTouchPoints || (window.navigator.msManipulationViewsEnabled && window.navigator.maxTouchPoints)),
			/**
			* `true` if the platform has native double-finger [events]{@glossary event}.
			* @public
			*/
			gesture: Boolean(('ongesturestart' in window) || ('onmsgesturestart' in window && (window.navigator.msMaxTouchPoints > 1 || window.navigator.maxTouchPoints > 1)))

			/**
			* The name of the platform that was detected or `undefined` if the platform
			* was unrecognized. This value is the key name for the major version of the
			* platform on the exported object.
			* @member {String} platformName
			* @public
			*/

		};

		var ua = navigator.userAgent;
		var ep = exports;
		var platforms = [
			// Windows Phone 7 - 10
			{platform: 'windowsPhone', regex: /Windows Phone (?:OS )?(\d+)[.\d]+/},
			// Android 4+ using Chrome
			{platform: 'androidChrome', regex: /Android .* Chrome\/(\d+)[.\d]+/},
			// Android 2 - 4
			{platform: 'android', regex: /Android(?:\s|\/)(\d+)/},
			// Kindle Fire
			// Force version to 2, (desktop mode does not list android version)
			{platform: 'android', regex: /Silk\/1./, forceVersion: 2, extra: {silk: 1}},
			// Kindle Fire HD (Silk versions 2 or 3)
			// Force version to 4
			{platform: 'android', regex: /Silk\/2./, forceVersion: 4, extra: {silk: 2}},
			{platform: 'android', regex: /Silk\/3./, forceVersion: 4, extra: {silk: 3}},
			// IE 8 - 10
			{platform: 'ie', regex: /MSIE (\d+)/},
			// IE 11
			{platform: 'ie', regex: /Trident\/.*; rv:(\d+)/},
			// Edge
			{platform: 'edge', regex: /Edge\/(\d+)/},
			// iOS 3 - 5
			// Apple likes to make this complicated
			{platform: 'ios', regex: /iP(?:hone|ad;(?: U;)? CPU) OS (\d+)/},
			// webOS 1 - 3
			{platform: 'webos', regex: /(?:web|hpw)OS\/(\d+)/},
			// webOS 4 / OpenWebOS
			{platform: 'webos', regex: /WebAppManager|Isis|webOS\./, forceVersion: 4},
			// Open webOS release LuneOS
			{platform: 'webos', regex: /LuneOS/, forceVersion: 4, extra: {luneos: 1}},
			// desktop Safari
			{platform: 'safari', regex: /Version\/(\d+)[.\d]+\s+Safari/},
			// desktop Chrome
			{platform: 'chrome', regex: /Chrome\/(\d+)[.\d]+/},
			// Firefox on Android
			{platform: 'androidFirefox', regex: /Android;.*Firefox\/(\d+)/},
			// FirefoxOS
			{platform: 'firefoxOS', regex: /Mobile;.*Firefox\/(\d+)/},
			// desktop Firefox
			{platform: 'firefox', regex: /Firefox\/(\d+)/},
			// Blackberry Playbook
			{platform: 'blackberry', regex: /PlayBook/i, forceVersion: 2},
			// Blackberry 10+
			{platform: 'blackberry', regex: /BB1\d;.*Version\/(\d+\.\d+)/},
			// Tizen
			{platform: 'tizen', regex: /Tizen (\d+)/}
		];
		for (var i = 0, p, m, v; (p = platforms[i]); i++) {
			m = p.regex.exec(ua);
			if (m) {
				if (p.forceVersion) {
					v = p.forceVersion;
				} else {
					v = Number(m[1]);
				}
				ep[p.platform] = v;
				if (p.extra) {
					utils.mixin(ep, p.extra);
				}
				ep.platformName = p.platform;
				break;
			}
		} 
	} (platform, platform.exports));

	var platformExports = platform.exports;

	(function (module, exports) {
		var
			json$1 = json,
			utils = utils$a,
			platform = platformExports;

		/**
		* These platforms only allow one argument for [console.log()]{@glossary console.log}:
		*
		* * android
		* * ios
		* * webos
		*
		* @ignore
		*/
		var dumbConsole = Boolean(platform.android || platform.ios || platform.webos);

		/**
		* Internally used methods and properties associated with logging.
		*
		* @module enyo/logger
		* @public
		*/
		exports = module.exports = {

			/**
			* The log level to use. Can be a value from -1 to 99, where -1 disables all
			* logging, 0 is 'error', 10 is 'warn', and 20 is 'log'. It is preferred that
			* this value be set using the [setLogLevel()]{@link module:enyo/logger#setLogLevel}
			* method.
			*
			* @type {Number}
			* @default 99
			* @public
			*/
			level: 99,

			/**
			* The known levels.
			*
			* @private
			*/
			levels: {log: 20, warn: 10, error: 0},

			/**
			* @private
			*/
			shouldLog: function (fn) {
				var ll = parseInt(this.levels[fn], 0);
				return (ll <= this.level);
			},

			/**
			* @private
			*/
			validateArgs: function (args) {
				// gracefully handle and prevent circular reference errors in objects
				for (var i=0, l=args.length, item; (item=args[i]) || i<l; i++) {
					try {
						if (typeof item === 'object') {
							args[i] = json$1.stringify(item);
						}
					} catch (e) {
						args[i] = 'Error: ' + e.message;
					}
				}
			},

			/**
			* @private
			*/
			_log: function (fn, args) {
				// avoid trying to use console on IE instances where the object hasn't been
				// created due to the developer tools being unopened
				var console = commonjsGlobal.console;
				if (typeof console === 'undefined') {
		            return;
		        }
				//var a$ = utils.logging.formatArgs(fn, args);
				var a$ = utils.isArray(args) ? args : utils.cloneArray(args);
				if (platform.androidFirefox) {
					// Firefox for Android's console does not handle objects with circular references
					this.validateArgs(a$);
				}
				if (dumbConsole) {
					// at least in early versions of webos, console.* only accept a single argument
					a$ = [a$.join(' ')];
				}
				var fn$ = console[fn];
				if (fn$ && fn$.apply) {
					// some consoles support 'warn', 'info', and so on
					fn$.apply(console, a$);
				} else if (console.log.apply) {
					// some consoles support console.log.apply
					console.log.apply(console, a$);
				} else {
					// otherwise, do our own formatting
					console.log(a$.join(' '));
				}
			},

			/**
			* This is exposed elsewhere.
			*
			* @private
			*/
			log: function (fn, args) {

				if (fn != 'log' && fn != 'warn' && fn != 'error') {
					args = Array.prototype.slice.call(arguments);
					fn = 'log';
				}

				var console = commonjsGlobal.console;
				if (typeof console !== 'undefined') {
					if (this.shouldLog(fn)) {
						this._log(fn, args);
					}
				}
			}
		};

		/**
		* Sets the log level to the given value. This will restrict the amount of output depending on
		* the settings. The higher the value, the more output that will be allowed. The default is
		* 99. The value, -1, would silence all logging, even 'error' (0).
		* Without the 'see': {@link module:enyo/logger#log}.
		*
		* @see module:enyo/logger#level
		* @see module:enyo/logger#log
		* @see module:enyo/logger#warn
		* @see module:enyo/logger#error
		* @param {Number} level - The level to set logging to.
		*/
		exports.setLogLevel = function (level) {
			var ll = parseInt(level, 0);
			if (isFinite(ll)) {
				this.level = ll;
			}
		};

		/**
		* A wrapper for [console.log()]{@glossary console.log}, compatible
		* across supported platforms. Will output only if the current
		* [log level]{@link module:enyo/logger#level} allows it. [Object]{@glossary Object}
		* parameters will be serialized via [JSON.stringify()]{@glossary JSON.stringify}
		* automatically.
		*
		* @utility
		* @see {@glossary console.log}
		* @param {...*} - The arguments to be logged.
		* @public
		*/

		/**
		* A wrapper for [console.warn()]{@glossary console.warn}, compatible
		* across supported platforms. Will output only if the current
		* [log level]{@link module:enyo/logger#level} allows it. [Object]{@glossary Object}
		* parameters will be serialized via [JSON.stringify()]{@glossary JSON.stringify}
		* automatically.
		*
		* @utility
		* @see {@glossary console.warn}
		* @param {...*} - The arguments to be logged.
		* @public
		*/
		exports.warn = function () {
			this.log('warn', arguments);
		};

		/**
		* A wrapper for [console.error()]{@glossary console.error}, compatible
		* across supported platforms. Will output only if the current
		* [log level]{@link module:enyo/logger#level} allows it. [Object]{@glossary Object}
		* parameters will be serialized via [JSON.stringify()]{@glossary JSON.stringify}
		* automatically.
		*
		* @utility
		* @see {@glossary console.error}
		* @param {...*} - The arguments to be logged.
		* @public
		*/
		exports.error = function () {
			this.log('error', arguments);
		}; 
	} (logger$3, logger$3.exports));

	var loggerExports = logger$3.exports;

	(function (module, exports) {
		var
			logger = loggerExports,
			utils = utils$a;

		var defaultCtor = null;

		/**
		* Creates a JavaScript {@glossary constructor} function with
		* a prototype defined by `props`. **All constructors must have a unique name.**
		*
		* `kind()` makes it easy to build a constructor-with-prototype (like a
		* class) that has advanced features like prototype-chaining
		* ({@glossary inheritance}).
		*
		* A plug-in system is included for extending the abilities of the
		* {@glossary kind} generator, and constructors are allowed to
		* perform custom operations when subclassed.
		*
		* If you make changes to `enyo/kind`, be sure to add or update the appropriate
		* [unit tests](@link https://github.com/enyojs/enyo/tree/master/tools/test/core/tests).
		*
		* For more information, see the documentation on
		* [Kinds]{@linkplain $dev-guide/key-concepts/kinds.html} in the Enyo Developer Guide.
		*
		* @module enyo/kind
		* @param {Object} props - A [hash]{@glossary Object} of properties used to define and create
		*	the {@glossary kind}
		* @public
		*/
		/*jshint -W120*/
		var kind = exports = module.exports = function (props) {
		/*jshint +W120*/
			// extract 'name' property
			var name = props.name || '';
			delete props.name;
			// extract 'kind' property
			var hasKind = ('kind' in props);
			var kindName = props.kind;
			delete props.kind;
			// establish base class reference
			var base = constructorForKind(kindName);
			var isa = base && base.prototype || null;
			// if we have an explicit kind property with value undefined, we probably
			// tried to reference a kind that is not yet in scope
			if (hasKind && kindName === undefined || base === undefined) {
				var problem = kindName === undefined ? 'undefined kind' : 'unknown kind (' + kindName + ')';
				throw 'enyo.kind: Attempt to subclass an ' + problem + '. Check dependencies for [' + (name || '<unnamed>') + '].';
			}
			// make a boilerplate constructor
			var ctor = kind.makeCtor();
			// semi-reserved word 'constructor' causes problems with Prototype and IE, so we rename it here
			if (props.hasOwnProperty('constructor')) {
				props._constructor = props.constructor;
				delete props.constructor;
			}
			// create our prototype
			//ctor.prototype = isa ? enyo.delegate(isa) : {};
			utils.setPrototype(ctor, isa ? utils.delegate(isa) : {});
			// there are special cases where a base class has a property
			// that may need to be concatenated with a subclasses implementation
			// as opposed to completely overwriting it...
			kind.concatHandler(ctor, props);

			// put in our props
			utils.mixin(ctor.prototype, props);
			// alias class name as 'kind' in the prototype
			// but we actually only need to set this if a new name was used,
			// not if it is inheriting from a kind anonymously
			if (name) {
				ctor.prototype.kindName = name;
			}
			// this is for anonymous constructors
			else {
				ctor.prototype.kindName = base && base.prototype? base.prototype.kindName: '';
			}
			// cache superclass constructor
			ctor.prototype.base = base;
			// reference our real constructor
			ctor.prototype.ctor = ctor;
			// support pluggable 'features'
			utils.forEach(kind.features, function(fn){ fn(ctor, props); });
			
			if (name) kindCtors[name] = ctor;
			
			return ctor;
		};

		exports.setDefaultCtor = function (ctor) {
			defaultCtor = ctor;
		};

		var getDefaultCtor = exports.getDefaultCtor = function () {
			return defaultCtor;
		};

		/**
		* @private
		*/
		var concatenated = exports.concatenated = [];

		/**
		* Creates a singleton of a given {@glossary kind} with a given
		* definition. **The `name` property will be the instance name of the singleton
		* and must be unique.**
		*
		* ```javascript
		* var
		* 	kind = require('enyo/kind'),
		* 	Control = require('enyo/Control');
		*
		* module.exports = singleton({
		* 	kind: Control,
		* 	name: 'app.MySingleton',
		* 	published: {
		* 		value: 'foo'
		* 	},
		* 	makeSomething: function() {
		* 		//...
		* 	}
		* });
		*
		* app.MySingleton.makeSomething();
		* app.MySingleton.setValue('bar');
		*```
		*
		* @public
		*/
		exports.singleton = function (conf) {
			// extract 'name' property (the name of our singleton)
			delete(conf.name);
			// create an unnamed kind and save its constructor's function
			var Kind = kind(conf);
			var inst = new Kind();
			return inst;
		};

		/**
		* @name module:enyo/kind.makeCtor
		* @method
		* @private
		*/
		kind.makeCtor = function () {
			var enyoConstructor = function () {
				if (!(this instanceof enyoConstructor)) {
					throw 'enyo.kind: constructor called directly, not using "new"';
				}

				// two-pass instantiation
				var result;
				if (this._constructor) {
					// pure construction
					result = this._constructor.apply(this, arguments);
				}
				// defer initialization until entire constructor chain has finished
				if (this.constructed) {
					// post-constructor initialization
					this.constructed.apply(this, arguments);
				}

				if (result) {
					return result;
				}
			};
			return enyoConstructor;
		};

		/**
		* Feature hooks for the oop system
		*
		* @name module:enyo/kind.features
		* @private
		*/
		kind.features = [];

		/**
		* Used internally by several mechanisms to allow safe and normalized handling for extending a
		* [kind's]{@glossary kind} super-methods. It can take a
		* [constructor]{@glossary constructor}, a [prototype]{@glossary Object.prototype}, or an
		* instance.
		*
		* @name module:enyo/kind.extendMethods
		* @method
		* @private
		*/
		kind.extendMethods = function (ctor, props, add) {
			var proto = ctor.prototype || ctor,
				b = proto.base;
			if (!proto.inherited && b) {
				proto.inherited = kind.inherited;
			}
			// rename constructor to _constructor to work around IE8/Prototype problems
			if (props.hasOwnProperty('constructor')) {
				props._constructor = props.constructor;
				delete props.constructor;
			}
			// decorate function properties to support inherited (do this ex post facto so that
			// ctor.prototype is known, relies on elements in props being copied by reference)
			for (var n in props) {
				var p = props[n];
				if (isInherited(p)) {
					// ensure that if there isn't actually a super method to call, it won't
					// fail miserably - while this shouldn't happen often, it is a sanity
					// check for mixin-extensions for kinds
					if (add) {
						p = proto[n] = p.fn(proto[n] || utils.nop);
					} else {
						p = proto[n] = p.fn(b? (b.prototype[n] || utils.nop): utils.nop);
					}
				}
				if (utils.isFunction(p)) {
					if (add) {
						proto[n] = p;
						p.displayName = n + '()';
					} else {
						p._inherited = b? b.prototype[n]: null;
						// FIXME: we used to need some extra values for inherited, then inherited got cleaner
						// but in the meantime we used these values to support logging in Object.
						// For now we support this legacy situation, by suppling logging information here.
						p.displayName = proto.kindName + '.' + n + '()';
					}
				}
			}
		};
		kind.features.push(kind.extendMethods);

		/**
		* Called by {@link module:enyo/CoreObject~Object} instances attempting to access super-methods
		* of a parent class ([kind]{@glossary kind}) by calling
		* `this.inherited(arguments)` from within a kind method. This can only be done
		* safely when there is known to be a super class with the same method.
		*
		* @name module:enyo/kind.inherited
		* @method
		* @private
		*/
		kind.inherited = function (originals, replacements) {
			// one-off methods are the fast track
			var target = originals.callee;
			var fn = target._inherited;

			// regardless of how we got here, just ensure we actually
			// have a function to call or else we throw a console
			// warning to notify developers they are calling a
			// super method that doesn't exist
			if ('function' === typeof fn) {
				var args = originals;
				if (replacements) {
					// combine the two arrays, with the replacements taking the first
					// set of arguments, and originals filling up the rest.
					args = [];
					var i = 0, l = replacements.length;
					for (; i < l; ++i) {
						args[i] = replacements[i];
					}
					l = originals.length;
					for (; i < l; ++i) {
						args[i] = originals[i];
					}
				}
				return fn.apply(this, args);
			} else {
				logger.warn('enyo.kind.inherited: unable to find requested ' +
					'super-method from -> ' + originals.callee.displayName + ' in ' + this.kindName);
			}
		};

		// dcl inspired super-inheritance

		var Inherited = function (fn) {
			this.fn = fn;
		};

		/**
		* When defining a method that overrides an existing method in a [kind]{@glossary kind}, you
		* can wrap the definition in this function and it will decorate it appropriately for inheritance
		* to work.
		*
		* The older `this.inherited(arguments)` method still works, but this version results in much
		* faster code and is the only one supported for kind [mixins]{@glossary mixin}.
		*
		* @param {Function} fn - A [function]{@glossary Function} that takes a single
		*   argument (usually named `sup`) and returns a function where
		*   `sup.apply(this, arguments)` is used as a mechanism to make the
		*   super-call.
		* @public
		*/
		exports.inherit = function (fn) {
			return new Inherited(fn);
		};

		/**
		* @private
		*/
		var isInherited = exports.isInherited = function (fn) {
			return fn && (fn instanceof Inherited);
		};


		//
		// 'statics' feature
		//
		kind.features.push(function(ctor, props) {
			// install common statics
			if (!ctor.subclass) {
				ctor.subclass = kind.statics.subclass;
			}
			if (!ctor.extend) {
				ctor.extend = kind.statics.extend;
			}
			if (!ctor.kind) {
				ctor.kind = kind.statics.kind;
			}
			// move props statics to constructor
			if (props.statics) {
				utils.mixin(ctor, props.statics);
				delete ctor.prototype.statics;
			}
			// also support protectedStatics which won't interfere with defer
			if (props.protectedStatics) {
				utils.mixin(ctor, props.protectedStatics);
				delete ctor.prototype.protectedStatics;
			}
			// allow superclass customization
			var base = ctor.prototype.base;
			while (base) {
				base.subclass(ctor, props);
				base = base.prototype.base;
			}
		});

		/**
		* @private
		*/
		kind.statics = {

			/**
			* A [kind]{@glossary kind} may set its own `subclass()` method as a
			* static method for its [constructor]{@glossary constructor}. Whenever
			* it is subclassed, the constructor and properties will be passed through
			* this method for special handling of important features.
			*
			* @name module:enyo/kind.subclass
			* @method
			* @param {Function} ctor - The [constructor]{@glossary constructor} of the
			*	[kind]{@glossary kind} being subclassed.
			* @param {Object} props - The properties of the kind being subclassed.
			* @public
			*/
			subclass: function (ctor, props) {},

			/**
			* Allows for extension of the current [kind]{@glossary kind} without
			* creating a new kind. This method is available on all
			* [constructors]{@glossary constructor}, although calling it on a
			* [deferred]{@glossary deferred} constructor will force it to be
			* resolved at that time. This method does not re-run the
			* {@link module:enyo/kind.features} against the constructor or instance.
			*
			* @name module:enyo/kind.extend
			* @method
			* @param {Object|Object[]} props A [hash]{@glossary Object} or [array]{@glossary Array}
			*	of [hashes]{@glossary Object}. Properties will override
			*	[prototype]{@glossary Object.prototype} properties. If a
			*	method that is being added already exists, the new method will
			*	supersede the existing one. The method may call
			*	`this.inherited()` or be wrapped with `kind.inherit()` to call
			*	the original method (this chains multiple methods tied to a
			*	single [kind]{@glossary kind}).
			* @param {Object} [target] - The instance to be extended. If this is not specified, then the
			*	[constructor]{@glossary constructor} of the
			*	[object]{@glossary Object} this method is being called on will
			*	be extended.
			* @returns {Object} The constructor of the class, or specific
			*	instance, that has been extended.
			* @public
			*/
			extend: function (props, target) {
				var ctor = this
					, exts = utils.isArray(props)? props: [props]
					, proto, fn;

				fn = function (key, value) {
					return !(typeof value == 'function' || isInherited(value)) && concatenated.indexOf(key) === -1;
				};

				proto = target || ctor.prototype;
				for (var i=0, ext; (ext=exts[i]); ++i) {
					kind.concatHandler(proto, ext, true);
					kind.extendMethods(proto, ext, true);
					utils.mixin(proto, ext, {filter: fn});
				}

				return target || ctor;
			},

			/**
			* Creates a new sub-[kind]{@glossary kind} of the current kind.
			*
			* @name module:enyo/kind.kind
			* @method
			* @param  {Object} props A [hash]{@glossary Object} of properties used to define and create
			*	the [kind]{@glossary kind}
			* @return {Function} Constructor of the new kind
			* @public
			*/
			kind: function (props) {
				if (props.kind && props.kind !== this) {
					logger.warn('Creating a different kind from a constructor\'s kind() method is not ' +
						'supported and will be replaced with the constructor.');
				}
				props.kind = this;
				return kind(props);
			}
		};

		/**
		* @method
		* @private
		*/
		exports.concatHandler = function (ctor, props, instance) {
			var proto = ctor.prototype || ctor
				, base = proto.ctor;

			while (base) {
				if (base.concat) base.concat(ctor, props, instance);
				base = base.prototype.base;
			}
		};

		var kindCtors =
		/**
		* Factory for [kinds]{@glossary kind} identified by [strings]{@glossary String}.
		*
		* @type Object
		* @deprecated Since 2.6.0
		* @private
		*/
			exports._kindCtors = {};

		/**
		* @method
		* @private
		*/
		var constructorForKind = exports.constructorForKind = function (kind) {
			if (kind === null) {
				return kind;
			} else if (kind === undefined) {
				return getDefaultCtor();
			}
			else if (utils.isFunction(kind)) {
				return kind;
			}
			logger.warn('Creating instances by name is deprecated. Name used:', kind);
			// use memoized constructor if available...
			var ctor = kindCtors[kind];
			if (ctor) {
				return ctor;
			}
			// otherwise look it up and memoize what we find
			//
			// if kind is an object in enyo, say "Control", then ctor = enyo["Control"]
			// if kind is a path under enyo, say "Heritage.Button", then ctor = enyo["Heritage.Button"] || enyo.Heritage.Button
			// if kind is a fully qualified path, say "enyo.Heritage.Button", then ctor = enyo["enyo.Heritage.Button"] || enyo.enyo.Heritage.Button || enyo.Heritage.Button
			//
			// Note that kind "Foo" will resolve to enyo.Foo before resolving to global "Foo".
			// This is important so "Image" will map to built-in Image object, instead of enyo.Image control.
			ctor = Theme[kind] || (commonjsGlobal.enyo && commonjsGlobal.enyo[kind]) || utils.getPath.call(commonjsGlobal, 'enyo.' + kind) || commonjsGlobal[kind] || utils.getPath.call(commonjsGlobal, kind);

			// If what we found at this namespace isn't a function, it's definitely not a kind constructor
			if (!utils.isFunction(ctor)) {
				throw '[' + kind + '] is not the name of a valid kind.';
			}
			kindCtors[kind] = ctor;
			return ctor;
		};

		/**
		* Namespace for current theme (`enyo.Theme.Button` references the Button specialization for the
		* current theme).
		*
		* @deprecated Since 2.6.0
		* @private
		*/
		var Theme = exports.Theme = {};

		/**
		* @method
		* @deprecated Since 2.6.0
		* @private
		*/
		exports.registerTheme = function (ns) {
			utils.mixin(Theme, ns);
		};

		/**
		* @method
		* @private
		*/
		exports.createFromKind = function (nom, param) {
			var Ctor = nom && constructorForKind(nom);
			if (Ctor) {
				return new Ctor(param);
			}
		}; 
	} (kind$e, kind$e.exports));

	var kindExports = kind$e.exports;

	var CoreObject$3 = {exports: {}};

	/**
	* Exports the {@link module:enyo/MixinSupport~MixinSupport} mixin.
	* @module enyo/MixinSupport
	*/

	var
		utils$9 = utils$a,
		kind$d = kindExports,
		logger$2 = loggerExports;

	kind$d.concatenated.push('mixins');

	var sup$3 = kind$d.statics.extend;

	var extend$1 = kind$d.statics.extend = function extend (args, target) {
		if (utils$9.isArray(args)) return utils$9.forEach(args, function (ln) { extend.call(this, ln, target); }, this);
		if (typeof args == 'string') apply(target || this.prototype, args);
		else {
			if (args.mixins) feature(target || this, args);
		
			// this allows for mixins to apply mixins which...is less than ideal but possible
			if (args.name) apply(target || this.prototype, args);
			else sup$3.apply(this, arguments);
		}
	};

	/*
	* Applies, with safeguards, a given mixin to an object.
	*/
	function apply (proto, props) {
		var applied = proto._mixins? (proto._mixins = proto._mixins.slice()): (proto._mixins = [])
			, name = utils$9.isString(props)? props: props.name
			, idx = utils$9.indexOf(name, applied);
		if (idx < 0) {
			name == props && (props = utils$9.getPath(name));
			// if we could not resolve the requested mixin (should never happen)
			// we throw a simple little error
			// @TODO: Normalize error format
			!props && logger$2.error('Could not find the mixin ' + name);
			
			// it should be noted that this ensures it won't recursively re-add the same mixin but
			// since it is possible for mixins to apply mixins the names will be out of order
			// this name is pushed on but the nested mixins are applied before this one
			name && applied.push(name);
			
			props = utils$9.clone(props);
			
			// we need to temporarily move the constructor if it has one so it
			// will override the correct method - this is a one-time permanent
			// runtime operation so subsequent additions of the mixin don't require
			// it again
			if (props.hasOwnProperty('constructor')) {
				props._constructor = props.constructor;
				delete props.constructor;
			}
			
			delete props.name;
			extend$1(props, proto);
			
			// now put it all back the way it was
			props.name = name;
		}
	}

	function feature (ctor, props) {
		if (props.mixins) {
			var proto = ctor.prototype || ctor
				, mixins = props.mixins;
			
			// delete props.mixins;
			// delete proto.mixins;
			
			proto._mixins && (proto._mixins = proto._mixins.slice());
			utils$9.forEach(mixins, function (ln) { apply(proto, ln); });
		}
	}

	kind$d.features.push(feature);

	/**
	* An internally-used support {@glossary mixin} that adds API methods to aid in
	* using and applying mixins to [kinds]{@glossary kind}.
	*
	* @mixin
	* @protected
	*/
	var MixinSupport$1 = {
		
		/**
		* @private
		*/
		name: 'MixinSupport',
		
		/**
		* Extends the instance with the given properties.
		*
		* @param {Object} props - The property [hash]{@glossary Object} from which to extend
		*	the callee.
		*/
		extend: function (props) {
			props && apply(this, props);
		},
		
		/**
		* @private
		*/
		importProps: kind$d.inherit(function (sup) {
			return function (props) {
				props && props.mixins && feature(this, props);
				
				sup.apply(this, arguments);
			};
		})
	};

	var MixinSupport_1 = MixinSupport$1;

	/**
	* Contains the declaration for the {@link module:enyo/LinkedListNode~LinkedListNode} kind.
	* @module enyo/LinkedListNode
	*/

	var
		kind$c = kindExports,
		utils$8 = utils$a;

	/**
	* An abstract linked-list node.
	*
	* @class LinkedListNode
	* @private
	*/
	var LinkedListNode$2 = kind$c(
		/** @lends module:enyo/LinkedListNode~LinkedListNode.prototype */ {
		
		/**
		* @private
		*/
		kind: null,
		
		/**
		* @private
		*/

		
		/**
		* @private
		*/
		prev: null,
		
		/**
		* @private
		*/
		next: null,
		
		/**
		* @private
		*/
		copy: function () {
			var cpy = new this.ctor();
			cpy.prev = this.prev;
			cpy.next = this.next;
			return cpy;
		},
		
		/**
		* @private
		*/
		constructor: function (props) {
			props && utils$8.mixin(this, props);
		},
		
		/**
		* @private
		*/
		destroy: function () {
			// clear reference to previous node
			this.prev = null;
			
			// if we have a reference to our next node
			// we continue down the chain
			this.next && this.next.destroy();
			
			// clear our reference to the next node
			this.next = null;
		}
	});

	/**
	* Contains the declaration for the {@link module:enyo/LinkedList~LinkedList} kind.
	* @module enyo/LinkedList
	*/

	var
		kind$b = kindExports;

	var
		LinkedListNode$1 = LinkedListNode$2;

	/**
	* An abstract linked-list.
	*
	* @class LinkedList
	* @private
	*/
	var LinkedList$1 = kind$b(
		/** @lends module:enyo/LinkedList~LinkedList.prototype */ {

		/**
		* @private
		*/
		kind: null,

		/**
		* @private
		*/
		nodeKind: LinkedListNode$1,

		/**
		* @private
		*/
		head: null,

		/**
		* @private
		*/
		tail: null,

		/**
		* @private
		*/
		length: 0,

		/**
		* @private
		*/
		clear: function () {
			if (this.head) {
				// this will trigger a chain event down the list
				this.head.destroy();
			}
			this.head = null;
			this.tail = null;
			this.length = 0;
		},

		/**
		* @private
		*/
		slice: function (fromNode, toNode) {
			var node = fromNode || this.head
				, list = new this.ctor()
				, cpy;

			// ensure we have a final node or our tail
			toNode = toNode || this.tail;

			if (node && node !== toNode) {
				do {
					cpy = node.copy();
					list.appendNode(cpy);
				} while ((node = node.next) && node !== toNode);
			}

			return list;
		},

		/**
		* @private
		*/
		destroy: function () {
			this.clear();
			this.destroyed = true;
		},

		/**
		* @private
		*/
		createNode: function (props) {
			return new this.nodeKind(props);
		},

		/**
		* @private
		*/
		deleteNode: function (node) {
			this.removeNode(node);

			// can't chain destruct because we removed its chain references
			node.destroy();
			return this;
		},

		/**
		* @private
		*/
		removeNode: function (node) {
			var prev = node.prev
				, next = node.next;

			prev && (prev.next = next);
			next && (next.prev = prev);
			this.length--;
			node.next = node.prev = null;
			return this;
		},

		/**
		* @private
		*/
		appendNode: function (node, targetNode) {
			targetNode = targetNode || this.tail;

			if (targetNode) {
				if (targetNode.next) {
					node.next = targetNode.next;
				}

				targetNode.next = node;
				node.prev = targetNode;

				if (targetNode === this.tail) {
					this.tail = node;
				}

				this.length++;
			} else {

				this.head = this.tail = node;
				node.prev = node.next = null;
				this.length = 1;
			}
			return this;
		},

		/**
		* @private
		*/
		find: function (fn, ctx, targetNode) {
			var node = targetNode || this.head;
			if (node) {
				do {
					if (fn.call(ctx || this, node, this)) {
						return node;
					}
				} while ((node = node.next));
			}
			// if no node qualified it returns false
			return false;
		},

		/**
		* @private
		*/
		forward: function (fn, ctx, targetNode) {
			var node = targetNode || this.head;
			if (node) {
				do {
					if (fn.call(ctx || this, node, this)) {
						break;
					}
				} while ((node = node.next));
			}
			// returns the last node (if any) that was processed in the chain
			return node;
		},

		/**
		* @private
		*/
		backward: function (fn, ctx, targetNode) {
			var node = targetNode || this.tail;
			if (node) {
				do {
					if (fn.call(ctx || this, node, this)) {
						break;
					}
				} while ((node = node.prev));
			}
			// returns the last node (if any) that was processed in the chain
			return node;
		},

		/**
		* @private
		*/
		constructor: function () {
			this.nodeType = kind$b.constructorForKind(this.nodeType);
		}
	});

	/**
	* Contains the declaration for the {@link module:enyo/ObserverChainNode~ObserverChainNode} kind.
	* @module enyo/ObserverChainNode
	*/

	var
		kind$a = kindExports;

	var
		LinkedListNode = LinkedListNode$2;

	function get$1 (base, prop) {
		return base && /*isObject(base)*/ (typeof base == 'object')? (
			base.get? base.get(prop): base[prop]
		): undefined;
	}

	/**
	* An internally used {@glossary kind}.
	*
	* @class ObserverChainNode
	* @extends module:enyo/LinkedListNode~LinkedListNode
	* @private
	*/
	var ObserverChainNode$1 = kind$a(
		/** @lends module:enyo/ObserverChainNode~ObserverChainNode.prototype */ {

		/**
		* @private
		*/
		kind: LinkedListNode,

		/**
		* @private
		*/

		
		/**
		* @method
		* @private
		*/
		constructor: kind$a.inherit(function (sup) {
			return function () {
				sup.apply(this, arguments);
				this.connect();
			};
		}),
		
		/**
		* @method
		* @private
		*/
		destroy: kind$a.inherit(function (sup) {
			return function () {
				this.disconnect();
				sup.apply(this, arguments);
				this.observer = null;
				this.list = null;
				this.object = null;
			};
		}),
		
		/**
		* @private
		*/
		connect: function () {
			var obj = this.object
				, obs = this._changed
				, prop = this.property;
			if (obj) {
				if (obj.observe) obj.observe(prop, obs, this, {noChain: true, priority: true});
				this.connected = true;
				this.list.connected++;
			}
		},
		
		/**
		* @private
		*/
		disconnect: function () {
			var obj = this.object
				, obs = this._changed
				, prop = this.property
				, was = this.connected;
			obj && obj.unobserve && obj.unobserve(prop, obs, this);
			this.connected = null;
			if (was) this.list.connected--;
		},
		
		/**
		* @private
		*/
		setObject: function (object) {
			var cur = this.object
				, prop = this.property
				, was, is;
			
			if (cur !== object) {
				this.disconnect();
				this.object = object;
				this.connect();
				
				if (this.list.tail === this) {
					was = get$1(cur, prop);
					is = get$1(object, prop);
					// @TODO: It would be better to somehow cache values
					// such that it could intelligently derive the difference
					// without needing to continuously look it up with get
					was !== is && this.list.observed(this, was, is);
				}
			}
		},
		
		/**
		* @private
		*/
		_changed: function (was, is) {
			this.list.observed(this, was, is);
		}
	});

	/**
	* Contains the declaration for the {@link module:enyo/ObserverChain~ObserverChain} kind.
	* @module enyo/ObserverChain
	*/

	var
		kind$9 = kindExports;

	var
		LinkedList = LinkedList$1,
		ObserverChainNode = ObserverChainNode$1;

	function get (base, prop) {
		return base && /*isObject(base)*/ (typeof base == 'object')? (
			base.get? base.get(prop): base[prop]
		): undefined;
	}

	/**
	* An internally used {@glossary kind}.
	*
	* @class ObserverChain
	* @extends module:enyo/LinkedList~LinkedList
	* @private
	*/
	var ObserverChain$1 = kind$9(
		/** @lends module:enyo/ObserverChain~ObserverChain.prototype */ {

		/**
		* @private
		*/
		kind: LinkedList,

		/**
		* @private
		*/
		nodeKind: ObserverChainNode,

		/**
		* @private
		*/

		
		/**
		* @private
		*/
		connected: 0,
		
		/**
		* @method
		* @private
		*/
		constructor: function (path, object) {
			this.object = object;
			this.path = path;
			this.parts = path.split('.');
			this.createChain();
		},
		
		/**
		* @method
		* @private
		*/
		destroy: kind$9.inherit(function (sup) {
			return function () {
				sup.apply(this, arguments);
				this.object = null;
				this.parts = null;
				this.path = null;
			};
		}),
		
		/**
		* @private
		*/
		rebuild: function (target) {
			if (!this.rebuilding) {
				this.rebuilding = true;
				this.forward(function (node) {
					if (node !== this.head) {
						var src = node.prev.object
							, prop = node.prev.property;
						node.setObject(get(src, prop));
					}
				}, this, target);
				this.rebuilding = false;
			}
		},
		
		/**
		* @private
		*/
		isConnected: function () {
			return !! (this.connected === this.length && this.length);
		},
		
		/**
		* @private
		*/
		buildPath: function (target) {
			var str = '';
			
			this.backward(function (node) {
				str = node.property + (str? ('.' + str): str);
			}, this, target);
			
			return str;
		},
		
		/**
		* @private
		*/
		createChain: function () {
			var parts = this.parts
				, next = this.object
				, $ = false
				, node, prop;
				
			for (var i=0; (prop=parts[i]); ++i) {
				
			// forEach(parts, function (prop, idx) {
				// we create a special case for the $ hash property
				if (prop == '$') {
					$ = true;
				} else {
					// in cases where the chain has the $ property we arbitrarily
					// force it onto our current nodes property and let the special handling
					// in ObserverChainNode and ObserverSupport handle the rest
					$ && (prop = '$.' + prop);
					node = this.createNode({property: prop, object: next, list: this});
					this.appendNode(node);
					next = get(next, prop);
					$ = false;
				}
			// }, this);
			}
		},
		
		/**
		* @private
		*/
		observed: function (node, was, is) {
			this.object.stopNotifications();
			// @NOTE: About the following two cases, they are mutually exclusive and this seems perfect
			// that we don't see double notifications
			// @TODO: Only notify if it was the full property path? This is far more efficient after
			// testing but not as flexible...
			node === this.tail /*&& was !== is*/ && this.object.notify(this.buildPath(node), was, is);
			// @TODO: It seems the same case across the board that the rebuild only needs to take place
			// from the beginning to the second-to-last elem
			node !== this.tail && was !== is && this.rebuild(node);
			this.object.startNotifications();
		}
	});

	/**
	* Exports the {@link module:enyo/ObserverSupport~ObserverSupport} mixin
	* @module enyo/ObserverSupport
	*/

	var
		kind$8 = kindExports,
		utils$7 = utils$a;

	var
		ObserverChain = ObserverChain$1;

	var observerTable = {};
		
	kind$8.concatenated.push("observers");

	/**
	* Responds to changes in one or more properties.
	* [Observers]{@link module:enyo/ObserverSupport~ObserverSupport#observers} may be registered in
	* several different ways. See the {@link module:enyo/ObserverSupport} documentation
	* for more details. Also note that, while observers should not be called
	* directly, if defined on a [kind]{@glossary kind}, they may be
	* overloaded for special behavior.
	*
	* @see {@link module:enyo/ObserverSupport}
	* @see {@link module:enyo/ObserverSupport~ObserverSupport#observe}
	* @callback module:enyo/ObserverSupport~ObserverSupport~Observer
	* @param {*} was - The previous value of the property that has changed.
	* @param {*} is - The current value of the property that has changed.
	* @param {String} prop - The name of the property that has changed.
	* @public
	*/

	function addObserver (path, fn, ctx, opts) {
		
		var observers = this.getObservers(),
			chains = this.getChains(),
			parts = path.split('.'),
			prio = opts && opts.priority,
			entries,
			noChain;
			
		noChain = (opts && opts.noChain) ||
				chains[path] ||
				parts.length < 2 ||
				(parts.length === 2 && path[0] == '$');
		
		if (observers[path] && !observers.hasOwnProperty(path)) {
			observers[path] = observers[path].slice();
		}
		
		entries = observers[path] || (observers[path] = []);
		entries[prio ? 'unshift' : 'push']({method: fn, ctx: ctx || this});
		
		if (!noChain) {
			this.getChains()[path] = new ObserverChain(path, this);
		}
		
		return this;
	}

	function removeObserver (obj, path, fn, ctx) {
		var observers = obj.getObservers(path)
			, chains = obj.getChains()
			, idx, chain;
			
		if (observers && observers.length) {
			idx = observers.findIndex(function (ln) {
				return ln.method === fn && (ctx? ln.ctx === ctx: true);
			});
			idx > -1 && observers.splice(idx, 1);
		}
		
		if ((chain = chains[path]) && !observers.length) {
			chain.destroy();
		}
		
		return obj;
	}

	function notifyObservers (obj, path, was, is, opts) {
		if (obj.isObserving()) {
			var observers = obj.getObservers(path);
			
			if (observers && observers.length) {
				for (var i=0, ln; (ln=observers[i]); ++i) {
					if (typeof ln.method == "string") obj[ln.method](was, is, path, opts);
					else ln.method.call(ln.ctx || obj, was, is, path, opts);
				}
			}
		} else enqueue(obj, path, was, is, opts);
		
		return obj;
	}

	function enqueue (obj, path, was, is, opts) {
		if (obj._notificationQueueEnabled) {
			var queue = obj._notificationQueue || (obj._notificationQueue = {})
				, ln = queue[path] || (queue[path] = {});
		
			ln.was = was;
			ln.is = is;
			ln.opts = opts;
		}
	}

	function flushQueue (obj) {
		var queue = obj._notificationQueue
			, path, ln;
		
		if (queue) {
			obj._notificationQueue = null;
			
			for (path in queue) {
				ln = queue[path];
				obj.notify(path, ln.was, ln.is, ln.opts);
			}
		}
	}
		
	/**
	* Adds support for notifications on property changes. Most
	* [kinds]{@glossary kind} (including all kinds that inherit from
	* {@link module:enyo/CoreObject~Object}) already have this {@glossary mixin} applied.
	* This allows for
	* [observers]{@link module:enyo/ObserverSupport~ObserverSupport~Observer} to be
	* [declared]{@link module:enyo/ObserverSupport~ObserverSupport#observers} or "implied" (see below).
	*
	* Implied observers are not declared, but derived from their `name`. They take
	* the form `<property>Changed`, where `<property>` is the property to
	* [observe]{@link module:enyo/ObserverSupport~ObserverSupport#observe}. For example:
	*
	* ```javascript
	* var
	* 	kind = require('enyo/kind');
	*
	* module.exports = kind({
	* 	name: 'MyKind',
	*
	* 	// some local property
	* 	value: true,
	*
	* 	// and the implied observer of that property
	* 	valueChanged: function (was, is) {
	* 		// do something now that it has changed
	* 		enyo.log('value was "' + was + '" but now it is "' + is + '"');
	* 	}
	* });
	*
	* var mine = new MyKind();
	* mine.set('value', false); // -> value was "true" but now it is "false"
	* ```
	*
	* Using the `observers` property for its declarative syntax, an observer may
	* observe any property (or properties), regardless of its `name`. For example:
	*
	* ```javascript
	* var
	* 	kind = require('enyo/kind');
	*
	* module.exports = kind({
	* 	name: 'MyKind',
	*
	* 	// some local property
	* 	value: true,
	*
	* 	// another local property
	* 	count: 1,
	*
	* 	// declaring the observer
	* 	observers: [
	* 		// the path can be a single string or an array of strings
	* 		{method: 'myObserver', path: ['value', 'count']}
	* 	],
	*
	* 	// now this observer will be notified of changes to both properties
	* 	myObserver: function (was, is, prop) {
	* 		// do something now that it changed
	* 		enyo.log(prop + ' was "' + was + '" but now it is "' + is + '"');
	* 	}
	* });
	*
	* var mine = new MyKind();
	* mine.set('value', false); // -> value was "true" but now it is "false"
	* mine.set('count', 2); // -> count was "1" but now it is "2"
	* ```
	*
	* While observers may be [notified]{@link module:enyo/ObserverSupport~ObserverSupport#notify} of
	* changes to multiple properties, this is not a typical use case for implied
	* observers, since, by convention, they are only registered for the named
	* property.
	*
	* There is one additional way to use observers, if necessary. You may use the
	* API methods [observe()]{@link module:enyo/ObserverSupport~ObserverSupport#observe} and
	* [unobserve()]{@link module:enyo/ObserverSupport~ObserverSupport#unobserve} to dynamically
	* register and unregister observers as needed. For example:
	*
	* ```javascript
	* var
	* 	Object = require('enyo/CoreObject').Object;
	*
	* var object = new Object({value: true});
	* var observer = function (was, is) {
	* 	enyo.log('value was "' + was + '" but now it is "' + is + '"');
	* };
	*
	* object.observe('value', observer);
	* object.set('value', false); // -> value was "true" but now it is "false"
	* object.unobserve('value', observer);
	* object.set('value', true); // no output because there is no observer
	* ```
	*
	* Be sure to read the documentation for these API methods; proper usage of
	* these methods is important for avoiding common pitfalls and memory leaks.
	*
	* @mixin
	* @public
	*/
	var ObserverSupport$1 = {
		
		/**
		* @private
		*/
		name: "ObserverSupport",
		
		/**
		* @private
		*/
		_observing: true,
		
		/**
		* @private
		*/
		_observeCount: 0,
		
		/**
		* @private
		*/
		_notificationQueue: null,
		
		/**
		* @private
		*/
		_notificationQueueEnabled: true,
		
		/**
		* Determines whether `_observing` is enabled. If
		* [stopNotifications()]{@link module:enyo/ObserverSupport~ObserverSupport#stopNotifications} has
		* been called, then this will return `false`.
		*
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#stopNotifications}
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#startNotifications}
		* @returns {Boolean} Whether or not the callee is observing.
		*/
		isObserving: function () {
			return this._observing;
		},
		
		/**
		* Returns an immutable list of [observers]{@link module:enyo/ObserverSupport~ObserverSupport~Observer}
		* for the given `path`, or all observers for the callee.
		*
		* @param {String} [path] - Path or property path for which
		* [observers]{@link module:enyo/ObserverSupport~ObserverSupport~Observer} will be returned. If not
		* specified, all observers for the callee will be returned.
		*
		* @returns {module:enyo/ObserverSupport~ObserverSupport~Observer[]} The immutable
		* [array]{@glossary Array} of observers.
		* @public
		*/
		getObservers: function (path) {
			var euid = this.euid || (this.euid = utils$7.uid('o')),
				ret,
				loc;
				
			loc = observerTable[euid] || (observerTable[euid] = (
				this._observers? Object.create(this._observers): {}
			));
			
			if (!path) return loc;
			
			ret = loc[path];
			
			// if the special property exists...
			if (loc['*']) ret = ret ? ret.concat(loc['*']) : loc['*'].slice();
			return ret;
		},
		
		/**
		* @private
		*/
		getChains: function () {
			return this._observerChains || (this._observerChains = {});
		},
		
		/**
		* @deprecated
		* @alias {@link module:enyo/ObserverSupport~ObserverSupport#observe}
		* @public
		*/
		addObserver: function () {
			// @NOTE: In this case we use apply because of internal variable use of parameters
			return addObserver.apply(this, arguments);
		},
		
		/**
		* Registers an [observer]{@link module:enyo/ObserverSupport~ObserverSupport~Observer} to be
		* [notified]{@link module:enyo/ObserverSupport~ObserverSupport#notify} when the given property has
		* been changed. It is important to note that it is possible to register the
		* same observer multiple times (although this is never the intention), so
		* care should be taken to avoid that scenario. It is also important to
		* understand how observers are stored and unregistered
		* ([unobserved]{@link module:enyo/ObserverSupport~ObserverSupport#unobserve}). The `ctx` (context)
		* parameter is stored with the observer reference. **If used when
		* registering, it should also be used when unregistering.**
		*
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#unobserve}
		* @param {String} path - The property or property path to observe.
		* @param {module:enyo/ObserverSupport~ObserverSupport~Observer} fn - The
		*	[observer]{@link module:enyo/ObserverSupport~ObserverSupport~Observer} method that responds to changes.
		* @param {*} [ctx] - The `this` (context) under which to execute the observer.
		*
		* @returns {this} The callee for chaining.
		* @public
		*/
		observe: function () {
			// @NOTE: In this case we use apply because of internal variable use of parameters
			return addObserver.apply(this, arguments);
		},
		
		/**
		* @deprecated
		* @alias {@link module:enyo/ObserverSupport~ObserverSupport#unobserve}
		* @public
		*/
		removeObserver: function (path, fn, ctx) {
			return removeObserver(this, path, fn);
		},
		
		/**
		* Unregisters an [observer]{@link module:enyo/ObserverSupport~ObserverSupport~Observer}. If a `ctx`
		* (context) was supplied to [observe()]{@link module:enyo/ObserverSupport~ObserverSupport#observe},
		* then it should also be supplied to this method.
		*
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#observe}
		* @param {String} path - The property or property path to unobserve.
		* @param {module:enyo/ObserverSupport~ObserverSupport~Observer} fn - The
		*	[observer]{@link module:enyo/ObserverSupport~ObserverSupport~Observer} method that responds to changes.
		* @param {*} [ctx] - The `this` (context) under which to execute the observer.
		*
		* @returns {this} The callee for chaining.
		* @public
		*/
		unobserve: function (path, fn, ctx) {
			return removeObserver(this, path, fn, ctx);
		},
		
		/**
		* Removes all [observers]{@link module:enyo/ObserverSupport~ObserverSupport~Observer} from the
		* callee. If a `path` parameter is provided, observers will only be removed
		* from that path (or property).
		*
		* @param {String} [path] - A property or property path from which to remove all
		*	[observers]{@link module:enyo/ObserverSupport~ObserverSupport~Observer}.
		* @returns {this} The callee for chaining.
		*/
		removeAllObservers: function (path) {
			var euid = this.euid
				, loc = euid && observerTable[euid];
			
			if (loc) {
				if (path) {
					loc[path] = null;
				} else {
					delete observerTable[euid];
				}
			}
			
			return this;
		},
		
		/**
		* @deprecated
		* @alias module:enyo/ObserverSupport~ObserverSupport#notify
		* @public
		*/
		notifyObservers: function (path, was, is, opts) {
			return notifyObservers(this, path, was, is, opts);
		},
		
		/**
		* Triggers any [observers]{@link module:enyo/ObserverSupport~ObserverSupport~Observer} for the
		* given `path`. The previous and current values must be supplied. This
		* method is typically called automatically, but it may also be called
		* forcibly by [setting]{@link module:enyo/CoreObject~Object#set} a value with the
		* `force` option.
		*
		* @param {String} path - The property or property path to notify.
		* @param {*} was - The previous value.
		* @param {*} is - The current value.
		* @returns {this} The callee for chaining.
		*/
		notify: function (path, was, is, opts) {
			return notifyObservers(this, path, was, is, opts);
		},
		
		/**
		* Stops all [notifications]{@link module:enyo/ObserverSupport~ObserverSupport#notify} from
		* propagating. By default, all notifications will be queued and flushed once
		* [startNotifications()]{@link module:enyo/ObserverSupport~ObserverSupport#startNotifications}
		* has been called. Setting the optional `noQueue` flag will also disable the
		* queue, or you can use the
		* [disableNotificationQueue()]{@link module:enyo/ObserverSupport~ObserverSupport#disableNotificationQueue} and
		* [enableNotificationQueue()]{@link module:enyo/ObserverSupport~ObserverSupport#enableNotificationQueue}
		* API methods. `startNotifications()` will need to be called the same number
		* of times that this method has been called.
		*
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#startNotifications}
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#disableNotificationQueue}
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#enableNotificationQueue}
		* @param {Boolean} [noQueue] - If `true`, this will also disable the notification queue.
		* @returns {this} The callee for chaining.
		*/
		stopNotifications: function (noQueue) {
			this._observing = false;
			this._observeCount++;
			noQueue && this.disableNotificationQueue();
			return this;
		},
		
		/**
		* Starts [notifications]{@link module:enyo/ObserverSupport~ObserverSupport#notify} if they have
		* been [disabled]{@link module:enyo/ObserverSupport~ObserverSupport#stopNotifications}. If the
		* notification queue was not disabled, this will automatically flush the
		* queue of all notifications that were encountered while stopped. This
		* method must be called the same number of times that
		* [stopNotifications()]{@link module:enyo/ObserverSupport~ObserverSupport#stopNotifications} was
		* called.
		*
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#stopNotifications}
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#disableNotificationQueue}
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#enableNotificationQueue}
		* @param {Boolean} [queue] - If `true` and the notification queue is disabled,
		* the queue will be re-enabled.
		* @returns {this} The callee for chaining.
		*/
		startNotifications: function (queue) {
			this._observeCount && this._observeCount--;
			this._observeCount === 0 && (this._observing = true);
			queue && this.enableNotificationQueue();
			this.isObserving() && flushQueue(this);
			return this;
		},
		
		/**
		* Re-enables the notification queue, if it was disabled.
		*
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#disableNotificationQueue}
		* @returns {this} The callee for chaining.
		*/
		enableNotificationQueue: function () {
			this._notificationQueueEnabled = true;
			return this;
		},
		
		/**
		* If the notification queue is enabled (the default), it will be disabled
		* and any notifications in the queue will be removed.
		*
		* @see {@link module:enyo/ObserverSupport~ObserverSupport#enableNotificationQueue}
		* @returns {this} The callee for chaining.
		*/
		disableNotificationQueue: function () {
			this._notificationQueueEnabled = false;
			this._notificationQueue = null;
			return this;
		},
		
		/**
		* @private
		*/
		constructor: kind$8.inherit(function (sup) {
			return function () {
				var chains, chain, path, entries, i;
				
				// if there are any observers that need to create dynamic chains
				// we look for and instance those now
				if (this._observerChains) {
					chains = this._observerChains;
					this._observerChains = {};
					for (path in chains) {
						entries = chains[path];
						for (i = 0; (chain = entries[i]); ++i) this.observe(path, chain.method);
					}
				}
				
				sup.apply(this, arguments);
			};
		}),
		
		/**
		* @private
		*/
		destroy: kind$8.inherit(function (sup) {
			return function () {
				var chains = this._observerChains,
					path,
					chain;
				
				sup.apply(this, arguments);

				this.removeAllObservers();
				if (chains) {
					for (path in chains) {
						chain = chains[path];
						chain.destroy();
					}
					
					this._observerChains = null;
				}
			};
		})
		
	};

	var ObserverSupport_1 = ObserverSupport$1;

	/**
	* Hijack the original so we can add additional default behavior.
	*
	* @private
	*/
	var sup$2 = kind$8.concatHandler;

	// @NOTE: It seems like a lot of work but it really won't happen that much and the more
	// we push to kind-time the better for initialization time

	/** @private */
	kind$8.concatHandler = function (ctor, props, instance) {
		
		sup$2.call(this, ctor, props, instance);
		
		if (props === ObserverSupport$1) return;

		var proto = ctor.prototype || ctor
			, observers = proto._observers? Object.create(proto._observers): null
			, incoming = props.observers
			, chains = proto._observerChains && Object.create(proto._observerChains);
			
		if (!observers) {
			if (proto.kindName) observers = {};
			else return;
		}
			
		if (incoming && !(incoming instanceof Array)) {
			(function () {
				var tmp = [], deps, name;
				// here is the slow iteration over the properties...
				for (name in props.observers) {
					// points to the dependencies of the computed method
					deps = props.observers[name];
					// create a single entry now for the method/computed with all dependencies
					tmp.push({method: name, path: deps});
				}
				incoming = tmp;
			}());
			// we need to ensure we don't modify the fixed array of a mixin or reused object
			// because it could wind up inadvertantly adding the same entry multiple times
		} else if (incoming) incoming = incoming.slice();
		
		// this scan is required to figure out what auto-observers might be present
		for (var key in props) {
			if (key.slice(-7) == "Changed") {
				incoming || (incoming = []);
				incoming.push({method: key, path: key.slice(0, -7)});
			}
		}
		
		var addObserverEntry = function (path, method) {
			var obs;
			// we have to make sure that the path isn't a chain because if it is we add it
			// to the chains instead
			if (path.indexOf(".") > -1) {
				if (!chains) chains = {};
				obs = chains[path] || (chains[path] = []);
				obs.push({method: method});
			} else {
				if (observers[path] && !observers.hasOwnProperty(path)) observers[path] = observers[path].slice();
				obs = observers[path] || (observers[path] = []);
				if (!obs.find(function (ln) { return ln.method == method; })) obs.push({method: method});
			}
		};
		
		if (incoming) {
			incoming.forEach(function (ln) {
				// first we determine if the path itself is an array of paths to observe
				if (ln.path && ln.path instanceof Array) ln.path.forEach(function (en) { addObserverEntry(en, ln.method); });
				else addObserverEntry(ln.path, ln.method);
			});
		}
		
		// we clear the key so it will not be added to the prototype
		// delete props.observers;
		// we update the properties to whatever their new values may be
		proto._observers = observers;
		proto._observerChains = chains;
	};

	var Binding$1 = {exports: {}};

	(function (module, exports) {
		/**
		* Contains the declaration for the {@link module:enyo/Binding~Binding} kind.
		* @module enyo/Binding
		*/

		var
			kind = kindExports,
			utils = utils$a;

		var bindings = [];

		var DIRTY_FROM = 0x01
			, DIRTY_TO = 0x02;

		/**
		* Used to determine if an {@link module:enyo/Binding~Binding} is actually ready.
		*
		* @private
		*/
		function ready (binding) {
			var rdy = binding.ready;
			
			if (!rdy) {
				
				var from = binding.from || '',
					to = binding.to || '',
					source = binding.source,
					target = binding.target,
					owner = binding.owner,
					twoWay = !binding.oneWay,
					toTarget;
				
				if (typeof from != 'string') from = '';
				if (typeof to != 'string') to = '';
				
				if (!source) {
					
					// the worst case scenario here is for backward compatibility purposes
					// we have to at least be able to derive the source via the from string
					if (from[0] == '^') {
						
						// this means we're reaching for a global
						var fromParts = from.split('.');
						from = fromParts.pop();
						source = utils.getPath.call(commonjsGlobal, fromParts.join('.').slice(1));
						
					} else {
						source = owner;
					}
					
				}
				
				if (!target) {
					
					// same worst case as above, for backwards compatibility purposes
					// we have to at least be able to derive the target via the to string
					if (to[0] == '^') {
						
						// this means we're reaching for a global
						var toParts = to.split('.');
						to = toParts.pop();
						target = utils.getPath.call(commonjsGlobal, toParts.join('.').slice(1));
					} else {
						target = owner;
					}
				}
				
				// we do this so we don't overwrite the originals in case we need to reset later
				binding._target = target;
				binding._source = source;
				binding._from = from[0] == '.'? from.slice(1): from;
				binding._to = to[0] == '.'? to.slice(1): to;
				
				if (!twoWay) {
					toTarget = binding._to.split('.');
					if (toTarget.length > 2) {
						toTarget.pop();
						binding._toTarget = toTarget.join('.');
					}
				}
				
				// now our sanitization
				rdy = !! (
					(source && (typeof source == 'object')) &&
					(target && (typeof target == 'object')) &&
					(from) &&
					(to)
				);
			}
			
			/*jshint -W093 */
			return (binding.ready = rdy);
			/*jshint +W093 */
		}


		/**
		* @class PassiveBinding
		* @public
		*/
		var PassiveBinding = kind(
			/** @lends module:enyo/Binding~PassiveBinding.prototype */ {
			
			name: 'enyo.PassiveBinding',
			
			/**
			* @private
			*/
			kind: null,
			
			/**
			* This property is used extensively for various purposes within a
			* [binding]{@link module:enyo/Binding~Binding}. One primary purpose is to serve as a root
			* [object]{@glossary Object} from which to	search for the binding's ends (the
			* [source]{@link module:enyo/Binding~Binding#source} and/or [target]{@link module:enyo/Binding~Binding#target}).
			* If the owner created the binding, it will also be responsible for destroying 
			* it (automatically).
			*
			* @type {module:enyo/CoreObject~Object}
			* @default null
			* @public
			*/
			owner: null,
			
			/**
			* Set this only to a reference for an [object]{@glossary Object} to use
			* as the source for the [binding]{@link module:enyo/Binding~Binding}. If this is not a
			* [bindable]{@link module:enyo/BindingSupport~BindingSupport} object, the source will be derived
			* from the [from]{@link module:enyo/Binding~Binding#from} property during initialization.
			* 
			* @type {Object}
			* @default null
			* @public
			*/
			source: null,
			
			/**
			* Set this only to a reference for an [object]{@glossary Object} to use
			* as the target for the [binding]{@link module:enyo/Binding~Binding}. If this is not a
			* [bindable]{@link module:enyo/BindingSupport~BindingSupport} object, the target will will be
			* derived from the [to]{@link module:enyo/Binding~Binding#to} property during initialization.
			* 
			* @type {Object}
			* @default null
			* @public
			*/
			target: null,
			
			/**
			* A path in which the property of the [source]{@link module:enyo/Binding~Binding#source} to
			* bind from may be found. If the source is explicitly provided and the path
			* is relative (i.e., it begins with a `"."`), it is relative to the source;
			* otherwise, it is relative to the [owner]{@link module:enyo/Binding~Binding#owner} of the
			* [binding]{@link module:enyo/Binding~Binding}. To have a binding be evaluated from the
			* global scope, prefix the path with a `"^"`. If the source and the `"^"`
			* are used in tandem, the `"^"` will be ignored and the path will be assumed
			* to be relative to the provided source.
			* 
			* @type {String}
			* @default null
			* @public
			*/
			from: null,
			
			/**
			* A path in which the property of the [target]{@link module:enyo/Binding~Binding#target} to
			* bind from may be found. If the target is explicitly provided and the path
			* is relative (i.e., it begins with a `"."`), it is relative to the target;
			* otherwise, it is relative to the owner of the [binding]{@link module:enyo/Binding~Binding}.
			* To have a binding be evaluated from the global scope, prefix the path with
			* a `"^"`. If the target and the `"^"` are used in tandem, the `"^"` will be
			* ignored and the path will be assumed to be relative to the provided target.
			* 
			* @type {String}
			* @default null
			* @public
			*/
			to: null,

			/**
			* Set this to a [function]{@glossary Function} or the name of a method on
			* the [owner]{@link module:enyo/Binding~Binding#owner} of this [binding]{@link module:enyo/Binding~Binding}.
			* The transform is used to programmatically modify the value being synchronized.
			* See {@link module:enyo/Binding~Binding~Transform} for detailed information on the parameters
			* that are available to `transform`.
			* 
			* @type {module:enyo/Binding~Binding~Transform}
			* @default null
			* @public
			*/
			transform: null,
			
			/**
			* Indicates whether the [binding]{@link module:enyo/Binding~Binding} is actually ready.
			* 
			* @returns {Boolean} `true` if ready; otherwise, `false`.
			* @public
			*/
			isReady: function () {
				return this.ready || ready(this);
			},
			
			/**
			* Causes a single propagation attempt to fail. Typically not called outside
			* the scope of a [transform]{@link module:enyo/Binding~Binding#transform}.
			* 
			* @public
			*/
			stop: function () {
				this._stop = true;
			},
			
			/**
			* Resets all properties to their original state.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			reset: function () {
				this.ready = null;
				this._source = this._target = this._to = this._from = this._toTarget = null;
				return this;
			},
			
			/**
			* Rebuilds the entire [binding]{@link module:enyo/Binding~Binding} and synchronizes
			* the value from the [source]{@link module:enyo/Binding~Binding#source} to the
			* [target]{@link module:enyo/Binding~Binding#target}.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			rebuild: function () {
				return this.reset().sync();
			},
			
			/**
			* Synchronizes values from the [source]{@link module:enyo/Binding~Binding#source} to the
			* [target]{@link module:enyo/Binding~Binding#target}. This usually will not need to be called manually.
			* [Two-way bindings]{@link module:enyo/Binding~Binding#oneWay} will automatically synchronize from the
			* target end once they are connected.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			sync: function () {
				var source, target, from, to, xform, val;

				if (this.isReady()) {
					source = this._source;
					target = this._target;
					from = this._from;
					to = this._to;
					xform = this.getTransform();
					val = utils.getPath.apply(source, [from]);

					if (xform) val = xform.call(this.owner || this, val, DIRTY_FROM, this);
					if (!this._stop) utils.setPath.apply(target, [to, val, {create: false}]);
				}
				
				return this;
			},
			
			/**
			* Releases all of the [binding's]{@link module:enyo/Binding~Binding} parts. Typically, this method will
			* not need to be called directly unless the binding was created without an
			* [owner]{@link module:enyo/Binding~Binding#owner}.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			destroy: function () {
				var owner = this.owner,
					idx;
				
				this.owner = null;
				this.source = this._source = null;
				this.target = this._target = null;
				this.ready = null;
				this.destroyed = true;
				
				// @todo: remove me or postpone operation?
				idx = bindings.indexOf(this);
				if (idx > -1) bindings.splice(idx, 1);
				
				if (owner && !owner.destroyed) owner.removeBinding(this);
				
				return this;
			},
			
			/**
			* @private
			*/
			getTransform: function () {
				return this._didInitTransform ? this.transform : (function (bnd) {
					bnd._didInitTransform = true;
					
					var xform = bnd.transform,
						owner = bnd.owner,
						xformOwner = owner && owner.bindingTransformOwner;
					
					if (xform) {
						if (typeof xform == 'string') {
							if (xformOwner && xformOwner[xform]) {
								xform = xformOwner[xform];
							} else if (owner && owner[xform]) {
								xform = owner[xform];
							} else {
								xform = utils.getPath.call(commonjsGlobal, xform);
							}
						}
						
						/*jshint -W093 */
						return (bnd.transform = (typeof xform == 'function' ? xform : null));
						/*jshint +W093 */
					}
				})(this);
			},
			
			/**
			* @private
			*/
			constructor: function (props) {
				bindings.push(this);
				
				if (props) utils.mixin(this, props);
				
				if (!this.euid) this.euid = utils.uid('b');

				this.sync();
			}
		});

		/**
		* The details for an {@link module:enyo/Binding~Binding#transform} [function]{@glossary Function},
		* including the available parameters and how they can be used.
		* 
		* @callback module:enyo/Binding~Binding~Transform
		* @param {*} value - The value being synchronized.
		* @param {Number} direction - The direction of synchronization; will be either
		* 	1 (source value has changed and will be written to target) or 2 (target
		* 	value has changed and will be written to source).
		* @param {Object} binding - A reference to the associated [binding]{@link module:enyo/Binding~Binding}. In cases 
		* 	where the binding should be interrupted and not propagate the synchronization at all, call
		* 	the [stop()]{@link module:enyo/Binding~Binding#stop} method on the passed-in binding reference.
		*/

		/**
		* {@link module:enyo/Binding~Binding} is a mechanism used to keep properties synchronized. A 
		* binding may be used to link two properties on different
		* [objects]{@glossary Object}, or even two properties on the same object.
		* Once a binding has been established, it will wait for change notifications;
		* when a notification arrives, the binding will synchronize the value between
		* the two ends. Note that bindings may be either
		* [one-way]{@link module:enyo/Binding~Binding#oneWay} (the default) or
		* [two-way]{@link module:enyo/Binding~Binding#oneWay}.
		* 
		* Usually, you will not need to create Binding objects arbitrarily, but will
		* instead rely on the public [BindingSupport API]{@link module:enyo/BindingSupport~BindingSupport},
		* which is applied to [Object]{@link module:enyo/CoreObject~Object} and so is available on
		* all of its [subkinds]{@glossary subkind}.
		* 
		* @class Binding
		* @public
		*/
		exports = module.exports = kind(
			/** @lends module:enyo/Binding~Binding.prototype */ {
			
			name: 'enyo.Binding',
			
			/**
			* @private
			*/
			kind: PassiveBinding,
			
			/**
			* If a [binding]{@link module:enyo/Binding~Binding} is one-way, this flag should be `true` (the default). 
			* If this flag is set to `false`, the binding will be two-way.
			*
			* @type {Boolean}
			* @default true
			* @public
			*/
			oneWay: true,
			
			/**
			* If the [binding]{@link module:enyo/Binding~Binding} was able to resolve both ends (i.e., its 
			* [source]{@link module:enyo/Binding~Binding#source} and [target]{@link module:enyo/Binding~Binding#target} 
			* [objects]{@glossary Object}), this value will be `true`. Setting this manually will
			* have undesirable effects.
			*
			* @type {Boolean}
			* @default false
			* @public
			*/
			connected: false,
			
			/**
			* By default, a [binding]{@link module:enyo/Binding~Binding} will attempt to connect to both ends 
			* ([source]{@link module:enyo/Binding~Binding#source} and [target]{@link module:enyo/Binding~Binding#target}). If this 
			* process should be deferred, set this flag to `false`.
			*
			* @type {Boolean}
			* @default true
			* @public
			*/
			autoConnect: true,
			
			/**
			* By default, a [binding]{@link module:enyo/Binding~Binding} will attempt to synchronize its values from 
			* its [source]{@link module:enyo/Binding~Binding#source} to its [target]{@link module:enyo/Binding~Binding#target}. If 
			* this process should be deferred, set this flag to `false`.
			* 
			* @type {Boolean}
			* @default true
			* @public
			*/
			autoSync: true,
			
			/**
			* The `dirty` property represents the changed value state of both the property designated by
			* the [from]{@link module:enyo/Binding~Binding#from} path and the property designated by the 
			* [to]{@link module:enyo/Binding~Binding#to} path.
			*
			* @type {Number}
			* @default module:enyo/Binding#DIRTY_FROM
			* @public
			*/
			dirty: DIRTY_FROM,
			
			/**
			* Indicates whether the [binding]{@link module:enyo/Binding~Binding} is currently connected.
			*
			* @returns {Boolean} `true` if connected; otherwise, `false`.
			* @public
			*/
			isConnected: function () {
				var from = this._from,
					to = this.oneWay ? (this._toTarget || this._to) : this._to,
					source = this._source,
					target = this._target,
					toChain,
					fromChain;
					
				if (from && to && source && target) {
					if (!this.oneWay || this._toTarget) toChain = target.getChains()[to];
					fromChain = source.getChains()[from];
					
					return this.connected
						&& (fromChain ? fromChain.isConnected() : true)
						&& (toChain ? toChain.isConnected() : true);
				}
				
				return false;
			},
			
			/**
			* Resets all properties to their original state.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			reset: function () {
				this.disconnect();
				return PassiveBinding.prototype.reset.apply(this, arguments);
			},
			
			/**
			* Rebuilds the entire [binding]{@link module:enyo/Binding~Binding}. Will synchronize if it is able to 
			* connect and the [autoSync]{@link module:enyo/Binding~Binding#autoSync} flag is `true`.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			rebuild: function () {
				return this.reset().connect();
			},
			
			/**
			* Connects the ends (i.e., the [source]{@link module:enyo/Binding~Binding#source} and
			* [target]{@link module:enyo/Binding~Binding#target}) of the [binding]{@link module:enyo/Binding~Binding}. While you
			* typically won't need to call this method, it is safe to call even when the ends are
			* already established. Note that if one or both of the ends does become connected and the
			* [autoSync]{@link module:enyo/Binding~Binding#autoSync} flag is `true`, the ends will automatically be
			* synchronized.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			connect: function () {
				if (!this.isConnected()) {
					if (this.isReady()) {
						this._source.observe(this._from, this._sourceChanged, this, {priority: true});
						
						// for two-way bindings we register to observe changes
						// from the target
						if (!this.oneWay) this._target.observe(this._to, this._targetChanged, this);
						else if (this._toTarget) {
							this._target.observe(this._toTarget, this._toTargetChanged, this, {priority: true});
						}
						
						// we flag it as having been connected
						this.connected = true;
						if (this.isConnected() && this.autoSync) this.sync(true);
					}
				}
				
				return this;
			},
			
			/**
			* Disconnects from the ends (i.e., the [source]{@link module:enyo/Binding~Binding#source} and 
			* [target]{@link module:enyo/Binding~Binding#target}) if a connection exists at either end. This method 
			* will most likely not need to be called directly.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			disconnect: function () {
				if (this.isConnected()) {
					this._source.unobserve(this._from, this._sourceChanged, this);
					
					// for two-way bindings we unregister the observer from
					// the target as well
					if (!this.oneWay) this._target.unobserve(this._to, this._targetChanged, this);
					else if (this._toTarget) {
						this._target.unobserve(this._toTarget, this._toTargetChanged, this);
					}
					
					this.connected = false;
				}
				
				return this;
			},
			
			/**
			* Synchronizes values from the [source]{@link module:enyo/Binding~Binding#source} to the
			* [target]{@link module:enyo/Binding~Binding#target}. This usually will not need to be called manually.
			* [Two-way bindings]{@link module:enyo/Binding~Binding#oneWay} will automatically synchronize from the
			* target end once they are connected.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			sync: function (force) {
				var source = this._source,
					target = this._target,
					from = this._from,
					to = this._to,
					xform = this.getTransform(),
					val;
				
				if (this.isReady() && this.isConnected()) {
						
					switch (this.dirty || (force && DIRTY_FROM)) {
					case DIRTY_TO:
						val = target.get(to);
						if (xform) val = xform.call(this.owner || this, val, DIRTY_TO, this);
						if (!this._stop) source.set(from, val, {create: false});
						break;
					case DIRTY_FROM:
						
					// @TODO: This should never need to happen but is here just in case
					// it is ever arbitrarily called not having been dirty?
					// default:
						val = source.get(from);
						if (xform) val = xform.call(this.owner || this, val, DIRTY_FROM, this);
						if (!this._stop) target.set(to, val, {create: false});
						break;
					}
					this.dirty = null;
					this._stop = null;
				}
				
				return this;
			},
			
			/**
			* Releases all of the [binding's]{@link module:enyo/Binding~Binding} parts and unregisters its 
			* [observers]{@link module:enyo/ObserverSupport~ObserverSupport}. Typically, this method will not need to be called 
			* directly unless the binding was created without an [owner]{@link module:enyo/Binding~Binding#owner}.
			* 
			* @returns {this} The callee for chaining.
			* @public
			*/
			destroy: function () {
				this.disconnect();

				return PassiveBinding.prototype.destroy.apply(this, arguments);
			},
			
			/**
			* @private
			*/
			constructor: function (props) {
				bindings.push(this);
				
				if (props) utils.mixin(this, props);
				
				if (!this.euid) this.euid = utils.uid('b');
				if (this.autoConnect) this.connect();
			},
			
			/**
			* @private
			*/
			_sourceChanged: function (was, is, path) {
				// @TODO: Should it...would it benefit from using these passed in values?
				this.dirty = this.dirty == DIRTY_TO ? null : DIRTY_FROM;
				return this.dirty == DIRTY_FROM && this.sync();
			},
			
			/**
			* @private
			*/
			_targetChanged: function (was, is, path) {
				// @TODO: Same question as above, it seems useful but would it affect computed
				// properties or stale values?
				this.dirty = this.dirty == DIRTY_FROM ? null : DIRTY_TO;
				return this.dirty == DIRTY_TO && this.sync();
			},
			
			/**
			* @private
			*/
			_toTargetChanged: function (was, is, path) {
				this.dirty = DIRTY_FROM;
				this.reset().connect();
			}
		});

		/**
		* Retrieves a [binding]{@link module:enyo/Binding~Binding} by its global id.
		*
		* @param {String} euid - The [Enyo global id]{@glossary EUID} by which to retrieve a 
		*	[binding]{@link module:enyo/Binding~Binding}.
		* @returns {module:enyo/Binding~Binding|undefined} A reference to the binding if the id
		*	is found; otherwise, it will return [undefined]{@glossary undefined}.
		* 
		* @static
		* @public
		*/
		exports.find = function (euid) {
			return bindings.find(function (ln) {
				return ln.euid == euid;
			});
		};

		/**
		* All {@link module:enyo/Binding~Binding} instances are stored in this list and may be retrieved via the
		* {@link module:enyo/Binding.find} method using an {@link module:enyo/Binding~Binding#id} identifier.
		*
		* @type {module:enyo/Binding~Binding[]}
		* @default []
		* @public
		*/
		exports.bindings = bindings;

		/**
		* Possible value of the [dirty]{@link module:enyo/Binding~Binding#dirty} property, indicating that the value 
		* of the [binding source]{@link module:enyo/Binding~Binding#source} has changed.
		* 
		* @static
		* @public
		*/
		exports.DIRTY_FROM = DIRTY_FROM;

		/**
		* Possible value of the [dirty]{@link module:enyo/Binding~Binding#dirty} property, indicating that the value
		* of the [binding target]{@link module:enyo/Binding~Binding#target} has changed.
		* 
		* @static
		* @public
		*/
		exports.DIRTY_TO = DIRTY_TO;

		/**
		* The default [kind]{@glossary kind} that provides [binding]{@link module:enyo/Binding~Binding} 
		* functionality.
		* 
		* @static
		* @public
		*/
		exports.defaultBindingKind = exports;

		/**
		* The kind declaration for the [PassiveBinding]{@link module:enyo/Binding~PassiveBinding} kind
		* @public
		*/
		exports.PassiveBinding = PassiveBinding; 
	} (Binding$1, Binding$1.exports));

	var BindingExports = Binding$1.exports;

	/**
	* Exports the {@link module:enyo/BindingSupport~BindingSupport} mixin
	* @module enyo/BindingSupport
	*/

	var
		kind$7 = kindExports,
		utils$6 = utils$a;

	var
		Binding = BindingExports;

	kind$7.concatenated.push('bindings');

	/**
	* An internally-used {@glossary mixin} that is added to {@link module:enyo/CoreObject~Object}
	* and its [subkinds]{@glossary subkind}. It includes public and protected API
	* methods for working with [bindings]{@link module:enyo/Binding~Binding}.
	*
	* @mixin
	* @protected
	*/
	var BindingSupport$1 = {
		
		/**
		* @private
		*/
		name: 'BindingSupport',
		
		/**
		* @private
		*/
		_bindingSupportInitialized: false,
		
		/**
		* Imperatively creates a [binding]{@link module:enyo/Binding~Binding}. Merges a variable
		* number of [hashes]{@glossary Object} and instantiates a binding that
		* will have its [owner]{@link module:enyo/Binding~Binding#owner} property set to the callee
		* (the current {@link module:enyo/CoreObject~Object}). Bindings created in this way will be
		* [destroyed]{@link module:enyo/Binding~Binding#destroy} when their `owner` is
		* [destroyed]{@link module:enyo/CoreObject~Object#destroy}.
		*
		* @param {...Object} props A variable number of [hashes]{@glossary Object} that will
		*	be merged into the properties applied to the {@link module:enyo/Binding~Binding} instance.
		* @returns {this} The callee for chaining.
		* @public
		*/
		binding: function () {
			var args = utils$6.toArray(arguments)
				, props = utils$6.mixin(args)
				, bindings = this.bindings || (this.bindings = [])
				, passiveBindings = this.passiveBindings || (this.passiveBindings = [])
				, PBCtor = Binding.PassiveBinding
				, Ctor, bnd;
				
			props.owner = props.owner || this;
			Ctor = props.kind = props.kind || this.defaultBindingKind || Binding.defaultBindingKind;
			
			if (this._bindingSupportInitialized) {
				utils$6.isString(Ctor) && (Ctor = props.kind = kind$7.constructorForKind(Ctor));
				bnd = new Ctor(props);
				bindings.push(bnd);
				if (Ctor === PBCtor) {
					passiveBindings.push(bnd);
				}
				return bnd;
			} else bindings.push(props);
			
			return this;
		},
		
		/**
		* Removes and [destroys]{@link module:enyo/Binding~Binding#destroy} all of, or a subset of,
		* the [bindings]{@link module:enyo/Binding~Binding} belonging to the callee.
		*
		* @param {module:enyo/Binding~Binding[]} [subset] - The optional [array]{@glossary Array} of
		*	[bindings]{@link module:enyo/Binding~Binding} to remove.
		* @returns {this} The callee for chaining.
		* @public
		*/
		clearBindings: function (subset) {
			var bindings = subset || (this.bindings && this.bindings.slice());
			bindings.forEach(function (bnd) {
				bnd.destroy();
			});
			
			return this;
		},

		syncBindings: function (opts) {
			var all = opts && opts.all,
				force = opts && opts.force,
				bindings = all ? this.bindings : this.passiveBindings;

			bindings.forEach(function (b) {
				b.sync(force);
			});
		},
		
		/**
		* Removes a single {@link module:enyo/Binding~Binding} from the callee. (This does not
		* [destroy]{@link module:enyo/Binding~Binding#destroy} the binding.) Also removes the
		* [owner]{@link module:enyo/Binding~Binding#owner} reference if it is the callee.
		*
		* It should be noted that when a binding is destroyed, it is automatically
		* removed from its owner.
		*
		* @param {module:enyo/Binding~Binding} binding - The {@link module:enyo/Binding~Binding} instance to remove.
		* @returns {this} The callee for chaining.
		* @public
		*/
		removeBinding: function (binding) {
			utils$6.remove(binding, this.bindings);
			if (binding.ctor === Binding.PassiveBinding) {
				utils$6.remove(binding, this.passiveBindings);
			}
			
			if (binding.owner === this) binding.owner = null;
			
			return this;
		},
		
		/**
		* @private
		*/
		constructed: kind$7.inherit(function (sup) {
			return function () {
				var bindings = this.bindings;
				this._bindingSupportInitialized = true;
				if (bindings) {
					this.bindings = [];
					this.passiveBindings = [];
					bindings.forEach(function (def) {
						this.binding(def);
					}, this);
				}
				sup.apply(this, arguments);
			};
		}),
		
		/**
		* @private
		*/
		destroy: kind$7.inherit(function (sup) {
			return function () {
				sup.apply(this, arguments);
				this.bindings && this.bindings.length && this.clearBindings();
				this.bindings = null;
				this.passiveBindings = null;
			};
		})
	};

	var BindingSupport_1 = BindingSupport$1;

	/**
		Hijack the original so we can add additional default behavior.
	*/
	var sup$1 = kind$7.concatHandler
		, flags = {ignore: true};

	/**
	* @private
	*/
	kind$7.concatHandler = function (ctor, props, instance) {
		var proto = ctor.prototype || ctor
			, kind = props && (props.defaultBindingKind || Binding.defaultBindingKind)
			, defaults = props && props.bindingDefaults;
		
		sup$1.call(this, ctor, props, instance);
		if (props.bindings) {
			props.bindings.forEach(function (bnd) {
				defaults && utils$6.mixin(bnd, defaults, flags);
				bnd.kind || (bnd.kind = kind); 
			});
			
			proto.bindings = proto.bindings? proto.bindings.concat(props.bindings): props.bindings;
			delete props.bindings;
		}
	};

	/**
	* Exports the {@link module:enyo/ComputedSupport~ComputedSupport} mixin.
	* @module enyo/ComputedSupport
	*/

	var
		kind$6 = kindExports,
		utils$5 = utils$a;

	var extend = kind$6.statics.extend;
		
	kind$6.concatenated.push('computed');

	function getComputedValue (obj, path) {
		var cache = obj._getComputedCache(path)
			, isCached = obj._isComputedCached(path);
		
		// in the end, for efficiency and completeness in other situations
		// it is better to know the returned value of all computed properties
		// but in cases where they are set as cached we will sometimes use
		// that value
		if (cache.dirty || cache.dirty === undefined) {
			isCached && (cache.dirty = false);
			cache.previous = cache.value;
			cache.value = obj[path]();
		}
		
		return cache.value;
	}

	function queueComputed (obj, path) {
		var queue = obj._computedQueue || (obj._computedQueue = [])
			, deps = obj._computedDependencies[path];
			
		if (deps) {
			for (var i=0, dep; (dep=deps[i]); ++i) {
				if (!queue.length || -1 == queue.indexOf(dep)) queue.push(dep);
			}
		}
	}

	function flushComputed (obj) {
		var queue = obj._computedQueue;
		obj._computedQueue = null;
		if (queue && obj.isObserving()) {
			for (var i=0, ln; (ln=queue[i]); ++i) {
				obj.notify(ln, obj._getComputedCache(ln).value, getComputedValue(obj, ln));
			}
		}
	}

	/**
	* A {@glossary mixin} that adds API methods to support
	* [computed properties]{@glossary computed_property}. Unlike other support mixins,
	* this mixin does not need to be explicitly included by a [kind]{@glossary kind}. If the
	* `computed` [array]{@glossary Array} is found in a kind definition, this mixin will
	* automatically be included.
	*
	* @mixin
	* @public
	*/
	var ComputedSupport = {
		/**
		* @private
		*/
		name: 'ComputedSuport',
		
		/**
		* @private
		*/
		_computedRecursion: 0,
		
		/**
		* Primarily intended for internal use, this method determines whether the
		* given path is a known [computed property]{@glossary computed_property}.
		*
		* @param {String} path - The property or path to test.
		* @returns {Boolean} Whether or not the `path` is a
		*	[computed property]{@glossary computed_property}.
		* @public
		*/
		isComputed: function (path) {
			// if it exists it will be explicitly one of these cases and it is cheaper than hasOwnProperty
			return this._computed && (this._computed[path] === true || this._computed[path] === false);
		},
		
		/**
		* Primarily intended for internal use, this method determines whether the
		* given path is a known dependency of a
		* [computed property]{@glossary computed_property}.
		*
		* @param {String} path - The property or path to test.
		* @returns {Boolean} Whether or not the `path` is a dependency of a
		*	[computed property]{@glossary computed_property}.
		* @public
		*/
		isComputedDependency: function (path) {
			return !! (this._computedDependencies? this._computedDependencies[path]: false);
		},
		
		/**
		* @private
		*/
		get: kind$6.inherit(function (sup) {
			return function (path) {
				return this.isComputed(path)? getComputedValue(this, path): sup.apply(this, arguments);
			};
		}),
		
		/**
		* @private
		*/
		set: kind$6.inherit(function (sup) {
			return function (path) {
				// we do not accept parameters for computed properties
				return this.isComputed(path)? this: sup.apply(this, arguments);
			};
		}),
		
		/**
		* @private
		*/
		notifyObservers: function () {
			return this.notify.apply(this, arguments);
		},
		
		/**
		* @private
		*/
		notify: kind$6.inherit(function (sup) {
			return function (path, was, is) {
				this.isComputedDependency(path) && queueComputed(this, path);
				this._computedRecursion++;
				sup.apply(this, arguments);
				this._computedRecursion--;
				this._computedQueue && this._computedRecursion === 0 && flushComputed(this);
				return this;
			};
		}),
		
		/**
		* @private
		*/
		_isComputedCached: function (path) {
			return this._computed[path];
		},
		
		/**
		* @private
		*/
		_getComputedCache: function (path) {
			var cache = this._computedCache || (this._computedCache = {});
			return cache[path] || (cache[path] = {});
		}
	};

	/*
	* Hijack the original so we can add additional default behavior.
	*/
	var sup = kind$6.concatHandler;

	// @NOTE: It seems like a lot of work but it really won't happen that much and the more
	// we push to kind-time the better for initialization time

	/**
	* @private
	*/
	kind$6.concatHandler = function (ctor, props, instance) {

		sup.call(this, ctor, props, instance);

		// only matters if there are computed properties to manage
		if (props.computed) {
			
			var proto = ctor.prototype || ctor
				, computed = proto._computed? Object.create(proto._computed): {}
				, dependencies = proto._computedDependencies? Object.create(proto._computedDependencies): {};
			
			// if it hasn't already been applied we need to ensure that the prototype will
			// actually have the computed support mixin present, it will not apply it more
			// than once to the prototype
			extend(ComputedSupport, proto);
		
			// @NOTE: This is the handling of the original syntax provided for computed properties in 2.3.ish...
			// All we do here is convert it to a structure that can be used for the other scenario and preferred
			// computed declarations format
			if (!props.computed || !(props.computed instanceof Array)) {
				(function () {
					var tmp = [], deps, name, conf;
					// here is the slow iteration over the properties...
					for (name in props.computed) {
						// points to the dependencies of the computed method
						deps = props.computed[name];
						/*jshint -W083 */
						conf = deps && deps.find(function (ln) {
							// we deliberately remove the entry here and forcibly return true to break
							return typeof ln == 'object'? (utils$5.remove(deps, ln) || true): false;
						});
						/*jshint +W083 */
						// create a single entry now for the method/computed with all dependencies
						tmp.push({method: name, path: deps, cached: conf? conf.cached: null});
					}
					
					// note that we only do this one so even for a mixin that is evaluated several
					// times this would only happen once
					props.computed = tmp;
				}());
			}
			
			var addDependency = function (path, dep) {
				// its really an inverse look at the original
				var deps;
				
				if (dependencies[path] && !dependencies.hasOwnProperty(path)) dependencies[path] = dependencies[path].slice();
				deps = dependencies[path] || (dependencies[path] = []);
				deps.push(dep);
			};
			
			// now we handle the new computed properties the way we intended to
			for (var i=0, ln; (ln=props.computed[i]); ++i) {
				// if the entry already exists we are merely updating whether or not it is
				// now cached
				computed[ln.method] = !! ln.cached;
				// we must now look to add an entry for any given dependencies and map them
				// back to the computed property they will trigger
				/*jshint -W083 */
				if (ln.path && ln.path instanceof Array) ln.path.forEach(function (dep) { addDependency(dep, ln.method); });
				/*jshint +W083 */
				else if (ln.path) addDependency(ln.path, ln.method);
			}
			
			// arg, free the key from the properties so it won't be applied later...
			// delete props.computed;
			// make sure to reassign the correct items to the prototype
			proto._computed = computed;
			proto._computedDependencies = dependencies;
		}
	};

	/**
	* Contains the declaration for the {@link module:enyo/CoreObject~Object} kind.
	* @module enyo/CoreObject
	*/

	var
		kind$5 = kindExports,
		logger$1 = loggerExports,
		utils$4 = utils$a;

	var
		MixinSupport = MixinSupport_1,
		ObserverSupport = ObserverSupport_1,
		BindingSupport = BindingSupport_1;

	// ComputedSupport is applied to all kinds at creation time but must be require()'d somewhere to be
	// included in builds. This is that somewhere.


	/**
	* Used by all [objects]{@link module:enyo/CoreObject~Object} and [subkinds]{@glossary subkind} when using the
	* {@link module:enyo/CoreObject~Object#log}, {@link module:enyo/CoreObject~Object#warn} and {@link module:enyo/CoreObject~Object#error} methods.
	*
	* @private
	*/
	function log (method, args) {
		if (logger$1.shouldLog(method)) {
			try {
				throw new Error();
			} catch(err) {
				logger$1._log(method, [args.callee.caller.displayName + ': ']
					.concat(utils$4.cloneArray(args)));
				logger$1.log(err.stack);
			}
		}
	}

	/**
	* {@link module:enyo/CoreObject~Object} lies at the heart of the Enyo framework's implementations of property
	* publishing, computed properties (via the [ComputedSupport]{@link module:enyo/ComputedSupport}
	* {@glossary mixin}), and data binding (via the {@link module:enyo/BindingSupport~BindingSupport} mixin and
	* {@link module:enyo/Binding~Binding} object). It also provides several utility [functions]{@glossary Function}
	* for its [subkinds]{@glossary subkind}.
	*
	* @class Object
	* @mixes module:enyo/MixinSupport
	* @mixes module:enyo/ObserverSupport
	* @mixes module:enyo/BindingSupport
	* @public
	*/
	var CoreObject$2 = CoreObject$3.exports = kind$5(
		/** @lends module:enyo/CoreObject~Object.prototype */ {

		/**
		* @private
		*/
		name: 'enyo.Object',

		/**
		* @private
		*/
		kind: null,

		/**
		* @private
		*/


		/**
		* Will be `true` if the [destroy()]{@link module:enyo/CoreObject~Object#destroy} method has been called;
		* otherwise, `false`.
		*
		* @readonly
		* @type {Boolean}
		* @default false
		* @public
		*/
		destroyed: false,

		/**
		* @private
		*/
		mixins: [MixinSupport, ObserverSupport, BindingSupport],

		/**
		* @private
		*/
		constructor: function (props) {
			this.importProps(props);
		},

		/**
		* Imports the values from the given [object]{@glossary Object}. Automatically called
		* from the [constructor]{@link module:enyo/CoreObject~Object#constructor}.
		*
		* @param {Object} props - If provided, the [object]{@glossary Object} from which to
		*	retrieve [keys/values]{@glossary Object.keys} to mix in.
		* @returns {this} The callee for chaining.
		* @public
		*/
		importProps: function (props) {
			var key;

			if (props) {
				kind$5.concatHandler(this, props, true);
				// if props is a default hash this is significantly faster than
				// requiring the hasOwnProperty check every time
				if (!props.kindName) {
					for (key in props) {
						kind$5.concatenated.indexOf(key) === -1 && (this[key] = props[key]);
					}
				} else {
					for (key in props) {
						if (kind$5.concatenated.indexOf(key) === -1 && props.hasOwnProperty(key)) {
							this[key] = props[key];
						}
					}
				}
			}
			
			return this;
		},
		
		/**
		* Calls the [destroy()]{@link module:enyo/CoreObject~Object#destroy} method for the named {@link module:enyo/CoreObject~Object} 
		* property.
		*
		* @param {String} name - The name of the property to destroy, if possible.
		* @returns {this} The callee for chaining.
		* @public
		*/
		destroyObject: function (name) {
			if (this[name] && this[name].destroy) {
				this[name].destroy();
			}
			this[name] = null;
			
			return this;
		},
		
		/**
		* Sends a log message to the [console]{@glossary console}, prepended with the name
		* of the {@glossary kind} and method from which `log()` was invoked. Multiple
		* {@glossary arguments} are coerced to {@glossary String} and
		* [joined with spaces]{@glossary Array.join}.
		*
		* ```javascript
		* var kind = require('enyo/kind'),
		*     Object = require('enyo/CoreObject');
		* kind({
		*	name: 'MyObject',
		*	kind: Object,
		*	hello: function() {
		*		this.log('says', 'hi');
		*		// shows in the console: MyObject.hello: says hi
		*	}
		* });
		* ```
		* @public
		*/
		log: function () {
			var acc = arguments.callee.caller,
				nom = ((acc ? acc.displayName : '') || '(instance method)') + ':',
				args = Array.prototype.slice.call(arguments);
			args.unshift(nom);
			logger$1.log('log', args);
		},
		
		/**
		* Same as [log()]{@link module:enyo/CoreObject~Object#log}, except that it uses the 
		* console's [warn()]{@glossary console.warn} method (if it exists).
		*
		* @public
		*/
		warn: function () {
			log('warn', arguments);
		},
		
		/**
		* Same as [log()]{@link module:enyo/CoreObject~Object#log}, except that it uses the 
		* console's [error()]{@glossary console.error} method (if it exists).
		*
		* @public
		*/
		error: function () {
			log('error', arguments);
		},

		/**
		* Retrieves the value for the given path. The value may be retrieved as long as the given 
		* path is resolvable relative to the given {@link module:enyo/CoreObject~Object}. See
		* [getPath()]{@link module:enyo/utils#getPath} for complete details.
		*
		* This method is backwards-compatible and will automatically call any existing getter
		* method that uses the "getProperty" naming convention. (Moving forward, however, Enyo code
		* should use [computed properties]{@link module:enyo/ComputedSupport} instead of relying on the
		* getter naming convention.)
		*
		* @param {String} path - The path from which to retrieve a value.
		* @returns {*} The value for the given path or [undefined]{@glossary undefined} if 
		*	the path could not be completely resolved.
		* @public
		*/
		get: function () {
			return utils$4.getPath.apply(this, arguments);
		},
		
		/**
		* Updates the value for the given path. The value may be set as long as the
		* given path is resolvable relative to the given {@link module:enyo/CoreObject~Object}. See
		* [setPath()]{@link module:enyo/utils#setPath} for complete details.
		*
		* @param {String} path - The path for which to set the given value.
		* @param {*} value - The value to set.
		* @param {Object} [opts] - An options hash.
		* @returns {this} The callee for chaining.
		* @public
		*/
		set: function () {
			return utils$4.setPath.apply(this, arguments);
		},

		/**
		* Binds a [callback]{@glossary callback} to this [object]{@link module:enyo/CoreObject~Object}.
		* If the object has been destroyed, the bound method will be aborted cleanly,
		* with no value returned.
		*
		* This method should generally be used instead of {@link module:enyo/utils#bind} for running
		* code in the context of an instance of {@link module:enyo/CoreObject~Object} or one of its
		* [subkinds]{@glossary subkind}.
		*
		* @public
		*/
		bindSafely: function () {
			var args = Array.prototype.slice.call(arguments);
			args.unshift(this);
			return utils$4.bindSafely.apply(null, args);
		},
		
		/**
		* An abstract method (primarily) that sets the [destroyed]{@link module:enyo/CoreObject~Object#destroyed} 
		* property to `true`.
		*
		* @returns {this} The callee for chaining.
		* @public
		*/
		destroy: function () {
			
			// Since JS objects are never truly destroyed (GC'd) until all references are
			// gone, we might have some delayed action on this object that needs access
			// to this flag.
			// Using this.set to make the property observable
			return this.set('destroyed', true);
		}
	});

	/**
	* @private
	*/
	CoreObject$2.concat = function (ctor, props) {
		var pubs = props.published,
			cpy,
			prop;
			
		if (pubs) {
			cpy = ctor.prototype || ctor;
			for (prop in pubs) {
				// need to make sure that even though a property is 'published'
				// it does not overwrite any computed properties
				if (props[prop] && typeof props[prop] == 'function') continue;
				addGetterSetter(prop, pubs[prop], cpy);
			}
		}
	};

	/**
	* This method creates a getter/setter for a published property of an {@link module:enyo/CoreObject~Object}, but is
	* deprecated. It is maintained for purposes of backwards compatibility. The preferred method is 
	* to mark public and protected (private) methods and properties using documentation or other 
	* means and rely on the [get]{@link module:enyo/CoreObject~Object#get} and [set]{@link module:enyo/CoreObject~Object#set} methods of
	* {@link module:enyo/CoreObject~Object} instances.
	*
	* @private
	*/
	function addGetterSetter (prop, value, proto) {
		
		// so we don't need to re-execute this over and over and over...
		var cap = utils$4.cap(prop),
			getName = 'get' + cap,
			setName = 'set' + cap,
			getters = proto._getters || (proto._getters = {}),
			setters = proto._setters || (proto._setters = {}),
			fn;
		
		// we assign the default value from the published block to the prototype
		// so it will be initialized properly
		proto[prop] = value;
		
		// check for a supplied getter and if there isn't one we create one otherwise
		// we mark the supplied getter in the tracking object so the global getPath will
		// know about it
		if (!(fn = proto[getName]) || typeof fn != 'function') {
			fn = proto[getName] = function () {
				return utils$4.getPath.fast.call(this, prop);
			};
			
			// and we mark it as generated
			fn.generated = true;
		} else if (fn && typeof fn == 'function' && !fn.generated) getters[prop] = getName;
		
		// we need to do the same thing for the setters
		if (!(fn = proto[setName]) || typeof fn != 'function') {
			fn = proto[setName] = function (val) {
				return utils$4.setPath.fast.call(this, prop, val);
			};
			
			// and we mark it as generated
			fn.generated = true;
		} else if (fn && typeof fn == 'function' && !fn.generated) setters[prop] = setName;
	}

	var CoreObjectExports = CoreObject$3.exports;

	/**
	* Exports the {@link module:enyo/ApplicationSupport~ApplicationSupport} mixin.
	* @module enyo/ApplicationSupport
	*/

	var kind$4 = kindExports;

	/**
	* An internally-used support {@glossary mixin} that is applied to all
	* [components]{@link module:enyo/Component~Component} of an {@link module:enyo/Application~Application} instance
	* (and to their components, recursively). This mixin adds an `app` property to
	* each component -- a local reference to the `Application` instance that
	* the component belongs to.
	* 
	* @mixin
	* @protected
	*/
	var ApplicationSupport$1 = {

		/**
		* @private
		*/
		name: 'ApplicationSupport',

		/**
		* @private
		*/
		adjustComponentProps: kind$4.inherit(function (sup) {
			return function (props) {
				props.app = props.app || this.app;
				sup.apply(this, arguments);
			};
		}),

		/**
		* @private
		*/
		destroy: kind$4.inherit(function (sup) {
			return function () {
				// release the reference to the application
				this.app = null;
				sup.apply(this, arguments);
			};
		})

	};

	var ApplicationSupport_1 = ApplicationSupport$1;

	/**
	* Exports the {@link module:enyo/ComponentBindingSupport~ComponentBindingSupport} mixin.
	* @module enyo/ComponentBindingSupport
	*/

	var
		kind$3 = kindExports;

	/**
	* An internally-used {@glossary mixin} applied to {@link module:enyo/Component~Component}
	* instances to better support [bindings]{@link module:enyo/Binding~Binding}.
	*
	* @mixin
	* @protected
	*/
	var ComponentBindingSupport$1 = {
		
		/**
		* @private
		*/
		name: 'ComponentBindingSupport',
		
		/**
		* @private
		*/
		adjustComponentProps: kind$3.inherit(function (sup) {
			return function (props) {
				sup.apply(this, arguments);
				props.bindingTransformOwner || (props.bindingTransformOwner = this.getInstanceOwner());
			};
		})
	};

	var ComponentBindingSupport_1 = ComponentBindingSupport$1;

	var
		utils$3 = utils$a,
		kind$2 = kindExports;
		
	var CoreObject$1 = CoreObjectExports;

	/**
	* The {@link module:enyo/jobs} singleton provides a mechanism for queueing tasks
	* (i.e., functions) for execution in order of priority. The execution of the
	* current job stack may be blocked programmatically by setting a priority
	* level (run level) below which no jobs are executed.
	*
	* At the moment, only {@link module:enyo/Animator~Animator} uses this interface, setting a
	* priority of 4, which blocks all low priority tasks from executing during
	* animations. To maintain backward compatibility, jobs are assigned a priority
	* of 5 by default; thus they are not blocked by animations.
	*
	* Normally, application code will not use `enyo/jobs` directly, but will
	* instead use the [job()]{@link module:enyo/Component~Component#job} method of
	* {@link module:enyo/Component~Component}.
	*
	* @module enyo/jobs
	* @public
	*/
	var jobs = kind$2.singleton(
		/** @lends module:enyo/jobs */ {
		
		kind: CoreObject$1,
		
		/**
		* @private
		*/
		published: /** @lends module:enyo/jobs~jobs */ {
			
			/**
			* The current priority level.
			*
			* @type {Number}
			* @default 0
			* @public
			*/
			priorityLevel: 0
		},
		
		/**
		* Prioritized by index.
		*
		* @private
		*/
		_jobs: [ [], [], [], [], [], [], [], [], [], [] ],
		
		/**
		* @private
		*/
		_priorities: {},
		
		/**
		* @private
		*/
		_namedJobs: {},
		
		/**
		* @private
		*/
		_magicWords: {
			'low': 3,
			'normal': 5,
			'high': 7
		},
		
		/**
		* Adds a [job]{@link module:enyo/job} to the job queue. If the current priority
		* level is higher than this job's priority, this job gets deferred until the
		* job level drops; if it is lower, this job is run immediately.
		*
		* @param {Function} job - The actual {@glossary Function} to execute as the
		* [job]{@link module:enyo/job}.
		* @param {Number} priority - The priority of the job.
		* @param {String} nom - The name of the job for later reference.
		* @public
		*/
		add: function (job, priority, nom) {
			priority = priority || 5;

			// magic words: low = 3, normal = 5, high = 7
			priority = utils$3.isString(priority) ? this._magicWords[priority] : priority;

			// if a job of the same name exists, remove it first (replace it)
			if(nom){
				this.remove(nom);
				this._namedJobs[nom] = priority;
			}

			// if the job is of higher priority than the current priority level then
			// there's no point in queueing it
			if(priority >= this.priorityLevel){
				job();
			} else {
				this._jobs[priority - 1].push({fkt: job, name: nom});
			}
		},
		
		/**
		* Will remove the named [job]{@link module:enyo/job} from the queue.
		*
		* @param {String} nom - The name of the [job]{@link module:enyo/job} to remove.
		* @returns {Array} An {@glossary Array} that will contain the removed job if
		* it was found, or empty if it was not found.
		* @public
		*/
		remove: function (nom) {
			var jobs = this._jobs[this._namedJobs[nom] - 1];
			if(jobs){
				for(var j = jobs.length-1; j >= 0; j--){
					if(jobs[j].name === nom){
						return jobs.splice(j, 1);
					}
				}
			}
		},
		
		/**
		* Adds a new priority level at which jobs will be executed. If it is higher than the
		* highest current priority, the priority level rises. Newly added jobs below that priority
		* level are deferred until the priority is removed (i.e., unregistered).
		*
		* @param {Number} priority - The priority value to register.
		* @param {String} id - The name of the priority.
		* @public
		*/
		registerPriority: function(priority, id) {
			this._priorities[id] = priority;
			this.setPriorityLevel( Math.max(priority, this.priorityLevel) );
		},
		
		/**
		* Removes a priority level. If the removed priority was previously the
		* highest priority, the priority level drops to the next highest priority
		* and queued jobs with a higher priority are executed.
		*
		* @param {String} id - The name of the priority level to remove.
		* @public
		*/
		unregisterPriority: function (id) {
			var highestPriority = 0;

			// remove priority
			delete this._priorities[id];

			// find new highest current priority
			for( var i in this._priorities ){
				highestPriority = Math.max(highestPriority, this._priorities[i]);
			}

			this.setPriorityLevel( highestPriority );
		},
		
		/**
		* Tries to run next job if priority level has dropped.
		*
		* @type {module:enyo/ObserverSupport~ObserverSupport~Observer}
		* @private
		*/
		priorityLevelChanged: function (was) {
			if(was > this.priorityLevel){
				this._doJob();
			}
		},
		
		/**
		* Finds and executes the job of highest priority; in this way, all jobs with priority
		* greater than or equal to the current level are run, in order of their priority (highest
		* to lowest).
		*
		* @private
		*/
		_doJob: function () {
			var job;
			// find the job of highest priority above the current priority level
			// and remove from the job list
			for (var i = 9; i >= this.priorityLevel; i--){
				if (this._jobs[i].length) {
					job = this._jobs[i].shift();
					break;
				}
			}

			// allow other events to pass through
			if (job) {
				job.fkt();
				delete this._namedJobs[job.name];
				setTimeout(utils$3.bind(this, '_doJob'), 10);
			}
		}
	});

	/**
	* Contains the declaration for the {@link module:enyo/Component~Component} kind.
	* @module enyo/Component
	*/

	var
		kind$1 = kindExports,
		utils$2 = utils$a,
		logger = loggerExports;

	var
		CoreObject = CoreObjectExports,
		ApplicationSupport = ApplicationSupport_1,
		ComponentBindingSupport = ComponentBindingSupport_1,
		Jobs = jobs;

	var
		kindPrefix = {},
		unnamedCounter = 0;
		
	/**
	* @callback module:enyo/Component~Component~EventHandler
	* @param {module:enyo/Component~Component} sender - The [component]{@link module:enyo/Component~Component} that most recently
	*	propagated the {@glossary event}.
	* @param {Object} event - An [object]{@glossary Object} containing
	*	event information.
	* @returns {Boolean} A value indicating whether the event has been
	*	handled or not. If `true`, then bubbling is stopped.
	*/

	/**
	* A [hash]{@glossary Object} of references to all the [components]{@link module:enyo/Component~Component}
	* owned by this component. This property is updated whenever a new
	* component is added; the new component may be accessed via its
	* [name]{@link module:enyo/Component~Component#name} property. We may also observe changes on
	* properties of components referenced by the `$` property.
	*
	* Component access via the `$` hash:
	* ```javascript
	* var Component = require('enyo/Component');
	* var c = new Component({
	*	name: 'me',
	*	components: [
	*		{kind: Component, name: 'other'}
	*	]
	* });
	*
	* // We can now access 'other' on the $ hash of 'c', via c.$.other
	* ```
	*
	* Observing changes on a component referenced by the `$` property:
	* ```javascript
	* var c = new Component({
	*	name: 'me',
	*	components: [
	*		{kind: Component, name: 'other'}
	*	]
	* });
	*
	* c.addObserver('$.other.active', function() {
	*	// do something to respond to the "active" property of "other" changing
	* })
	*
	* c.$.other.set('active', true); // this will trigger the observer to run its callback
	* ```
	*
	* @name $
	* @type {Object}
	* @default null
	* @memberof module:enyo/Component~Component.prototype
	* @readonly
	* @public
	*/

	/**
	* If `true`, this [component's]{@link module:enyo/Component~Component} [owner]{@link module:enyo/Component~Component#owner} will
	* have a direct name reference to the owned component.
	*
	* @example
	* var Component = require('enyo/Component');
	* var c = new Component({
	*	name: 'me',
	*	components: [
	*		{kind: Component, name: 'other', publish: true}
	*	]
	* });
	*
	* // We can now access 'other' directly, via c.other
	*
	* @name publish
	* @type {Boolean}
	* @default undefined
	* @memberOf module:enyo/Component~Component.prototype
	* @public
	*/

	/**
	* If `true`, the [layout]{@glossary layout} strategy will adjust the size of this
	* [component]{@link module:enyo/Component~Component} to occupy the remaining available space.
	*
	* @name fit
	* @type {Boolean}
	* @default undefined
	* @memberOf module:enyo/Component~Component.prototype
	* @public
	*/

	/**
	* {@link module:enyo/Component~Component} is the fundamental building block for Enyo applications.
	* Components are designed to fit together, allowing complex behaviors to
	* be fashioned from smaller bits of functionality.
	*
	* Component [constructors]{@glossary constructor} take a single
	* argument (sometimes called a [component configuration]{@glossary configurationBlock}),
	* a JavaScript [object]{@glossary Object} that defines various properties to be initialized on the
	* component.  For example:
	*
	* ```javascript
	* // create a new component, initialize its name property to 'me'
	* var Component = require('enyo/Component');
	* var c = new Component({
	*	name: 'me'
	* });
	* ```
	*
	* When a component is instantiated, items configured in its
	* `components` property are instantiated, too:
	*
	* ```javascript
	* // create a new component, which itself has a component
	* var c = new Component({
	*	name: 'me',
	*	components: [
	*		{kind: Component, name: 'other'}
	*	]
	* });
	* ```
	*
	* In this case, when `me` is created, `other` is also created, and we say that `me` owns `other`.
	* In other words, the [owner]{@link module:enyo/Component~Component#owner} property of `other` equals `me`.
	* Notice that you can specify the [kind]{@glossary kind} of `other` explicitly in its
	* configuration block, to tell `me` what constructor to use to create `other`.
	*
	* To move a component, use the `setOwner()` method to change the
	* component's owner. If you want a component to be unowned, use `setOwner(null)`.
	*
	* If you make changes to `Component`, be sure to add or update the appropriate
	* {@linkplain https://github.com/enyojs/enyo/tree/master/tools/test/core/tests unit tests}.
	*
	* For more information, see the documentation on
	* [Components]{@linkplain $dev-guide/key-concepts/components.html} in the
	* Enyo Developer Guide.
	*
	* @class Component
	* @extends module:enyo/CoreObject~Object
	* @mixes module:enyo/ApplicationSupport~ApplicationSupport
	* @mixes module:enyo/ComponentBindingSupport~ComponentBindingSupport
	* @public
	*/
	var Component$2 = Component$3.exports = kind$1(
		/** @lends module:enyo/Component~Component.prototype */ {

		name: 'enyo.Component',

		/**
		* @private
		*/
		kind: CoreObject,

		/**
		* @private
		*/


		/**
		* @private
		*/
		cachedBubble: true,

		/**
		* @private
		*/
		cachePoint: false,

		/**
		* @private
		*/
		published:
			/** @lends module:enyo/Component~Component.prototype */ {

			/**
			* A unique name for the [component]{@link module:enyo/Component~Component} within its
			* [owner]{@link module:enyo/Component~Component#owner}. This is used to set the access name in the
			* owner's [$ hash]{@link module:enyo/Component~Component#$}. If not
			* specified, a default name will be provided based on the name of the
			* [object's]{@link module:enyo/CoreObject~Object} [kind]{@glossary kind}, with a numeric
			* suffix appended if more than one instance exists in the owner.
			*
			* @type {String}
			* @default ''
			* @public
			*/
			name: '',

			/**
			* A unique id for the [component]{@link module:enyo/Component~Component}, usually automatically generated
			* based on its position within the component hierarchy, although
			* it may also be directly specified. {@link module:enyo/Control~Control} uses this `id` value for the
			* DOM [id]{@link module:enyo/Control~Control#id} attribute.
			*
			* @type {String}
			* @default ''
			* @public
			*/
			id: '',

			/**
			* The [component]{@link module:enyo/Component~Component} that owns this component.
			* It is usually defined implicitly at creation time based on the
			* [createComponent()]{@link module:enyo/Component~Component#createComponent} call or
			* the `components` hash.
			*
			* @type {module:enyo/Component~Component}
			* @default null
			* @public
			*/
			owner: null,

			/**
			* This can be a [hash]{@glossary Object} of features to apply to
			* [chrome]{@glossary chrome} [components]{@link module:enyo/Component~Component} of the base
			* [kind]{@glossary kind}. They are matched by [name]{@link module:enyo/Component~Component#name}
			* (if the component you wish to modify does not have a name, this will not work).
			* You can modify any properties of the component except for methods. Setting a
			* value for `componentOverrides` at runtime will have no effect.
			*
			* @type {Object}
			* @default null
			* @public
			*/
			componentOverrides: null
		},

		/**
		* @private
		*/
		handlers: {},

		/**
		* @private
		*/
		mixins: [ApplicationSupport, ComponentBindingSupport],

		/**
		* @private
		*/
		toString: function () {
			return this.id + ' [' + this.kindName + ']';
		},

		/**
		* @method
		* @private
		*/
		constructor: kind$1.inherit(function (sup) {
			return function (props) {
				// initialize instance objects
				this._componentNameMap = {};
				this.$ = {};
				this.cachedBubbleTarget = {};
				sup.apply(this, arguments);
			};
		}),

		/**
		* @method
		* @private
		*/
		constructed: kind$1.inherit(function (sup) {
			return function (props) {
				// perform initialization
				this.create(props);
				sup.apply(this, arguments);
			};
		}),

		/**
		* @private
		*/
		create: function () {
			// stop and queue all of the notifications happening synchronously to allow
			// responders to only do single passes on work traversing the tree
			this.stopNotifications();
			this.ownerChanged();
			this.initComponents();
			// release the kraken!
			this.startNotifications();
		},

		/**
		* @private
		*/
		initComponents: function () {
			// The _components_ property in kind declarations is renamed to
			// _kindComponents_ by the Component subclass mechanism.  This makes it
			// easy for the developer to distinguish kindComponents from the components
			// in _this.components_, without having to worry about the actual difference.
			//
			// Specifically, the difference is that kindComponents are constructed as
			// owned by this control (whereas components in _this.components_ are not).
			// In addition, kindComponents are marked with the _isChrome: true_ flag.
			this.createChrome(this.kindComponents);
			this.createClientComponents(this.components);
		},

		/**
		* @private
		*/
		createChrome: function (comps) {
			this.createComponents(comps, {isChrome: true});
		},

		/**
		* @private
		*/
		createClientComponents: function (comps) {
			this.createComponents(comps, {owner: this.getInstanceOwner()});
		},

		/**
		* @private
		*/
		getInstanceOwner: function () {
			return (!this.owner || this.owner.notInstanceOwner) ? this : this.owner;
		},

		/**
		* Removes this [component]{@link module:enyo/Component~Component} from its
		* [owner]{@link module:enyo/Component~Component#owner} (setting `owner` to `null`)
		* and does any necessary cleanup. The component is flagged with
		* `destroyed: true`. Usually, the component will be suitable for garbage
		* collection after being destroyed, unless user code keeps a reference
		* to it.
		*
		* @returns {this} The callee for chaining.
		* @method
		* @public
		*/
		destroy: kind$1.inherit(function (sup) {
			return function () {
				this.destroyComponents();
				this.setOwner(null);
				sup.apply(this, arguments);
				this.stopAllJobs();
				return this;
			};
		}),

		/**
		* Destroys all owned [components]{@link module:enyo/Component~Component}.
		*
		* @returns {this} The callee for chaining.
		* @public
		*/
		destroyComponents: function () {
			var comps = this.getComponents(),
				comp,
				i;

			for (i = 0; i < comps.length; ++i) {
				comp = comps[i];
				// @todo: previous comment said list might be stale and ownership may have caused
				// components to be destroyed as a result of some inner-container...look into this
				// because that seems incorrect or avoidable
				if (!comp.destroyed) comp.destroy();
			}

			return this;
		},

		/**
		* @private
		*/
		makeId: function() {
			var delim = '_', pre = this.owner && this.owner.getId(),
				baseName = this.name || ('@@' + (++unnamedCounter));
			return (pre ? pre + delim : '') + baseName;
		},

		/**
		* @private
		*/
		ownerChanged: function (was) {
			if (was && was.removeComponent) was.removeComponent(this);
			if (this.owner && this.owner.addComponent) this.owner.addComponent(this);
			if (!this.id) this.id = this.makeId();
		},

		/**
		* @private
		*/
		nameComponent: function (comp) {
			var pre = prefixFromKindName(comp.kindName),
				last = this._componentNameMap[pre] || 0,
				nom;

			do {
				nom = pre + (++last > 1 ? String(last) : '');
			} while (this.$[nom]);

			this._componentNameMap[pre] = Number(last);
			/*jshint -W093 */
			return (comp.name = nom);
		},

		/**
		* Adds a [component]{@link module:enyo/Component~Component} to the list of components
		* owned by the current component (i.e., [this.$]{@link module:enyo/Component~Component#$}).
		*
		* @param {module:enyo/Component~Component} comp - The [component]{@link module:enyo/Component~Component} to add.
		* @returns {this} The callee for chaining.
		* @public
		*/
		addComponent: function (comp) {
			var nom = comp.get('name');

			// if there is no name we have to come up with a generic name
			if (!nom) nom = this.nameComponent(comp);

			// if there already was a component by that name we issue a warning
			// @todo: if we're going to name rules being violated we need to normalize this approach
			// and ensure we have one for every warning/error we throw
			if (this.$[nom]) this.warn(
				'Duplicate component name ' + nom + ' in owner ' + this.id + ' violates ' +
				'unique-name-under-owner rule, replacing existing component in the hash and ' +
				'continuing, but this is an error condition and should be fixed.'
			);

			this.$[nom] = comp;
			this.notify('$.' + nom, null, comp);

			// if the component has the `publish` true property then we also create a reference to
			// it directly on the owner (this)
			if (comp.publish) {
				this[nom] = comp;

				// and to ensure that bindings are aware we have to notify them as well
				this.notify(nom, null, comp);
			}

			return this;
		},

		/**
		* Removes the passed-in [component]{@link module:enyo/Component~Component} from those known
		* to be owned by this component. The component will be removed from the
		* [$ hash]{@link module:enyo/Component~Component#$}, and from the [owner]{@link module:enyo/Component~Component#owner}
		* directly if [publish]{@link module:enyo/Component~Component#publish} is set to `true`.
		*
		* @param {module:enyo/Component~Component} comp - The component to remove.
		* @returns {this} The callee for chaining.
		* @public
		*/
		removeComponent: function (comp) {
			var nom = comp.get('name');

			// remove it from the hash if it existed
			delete this.$[nom];

			// if it was published remove it from the component proper
			if (comp.publish) delete this[nom];

			return this;
		},

		/**
		* Returns an [array]{@glossary Array} of owned [components]{@link module:enyo/Component~Component}; in
		* other words, converts the [$ hash]{@link module:enyo/Component~Component#$} into an array
		* and returns the array.
		*
		* @returns {module:enyo/Component~Component[]} The [components]{@link module:enyo/Component~Component} found in the
		*	[$ hash]{@link module:enyo/Component~Component#$}.
		* @public
		*/
		getComponents: function () {
			return utils$2.values(this.$);
		},

		/**
		* @private
		*/
		adjustComponentProps: function (props) {
			if (this.defaultProps) utils$2.mixin(props, this.defaultProps, {ignore: true});
			props.kind = props.kind || props.isa || this.defaultKind;
			props.owner = props.owner || this;
		},

		/**
		* @private
		*/
		_createComponent: function (props, ext) {
			var def = ext ? utils$2.mixin({}, [ext, props]) : utils$2.clone(props);

			// always adjust the properties according to the needs of the kind and parent kinds
			this.adjustComponentProps(def);

			// pass along for the final stage
			return Component$2.create(def);
		},

		/**
		* Creates and returns a [component]{@link module:enyo/Component~Component} as defined by the combination of
		* a base and an additional property [hash]{@glossary Object}. The properties provided
		* in the standard property hash override those provided in the
		* additional property hash.
		*
		* The created component passes through initialization machinery
		* provided by the creating component, which may supply special
		* handling. Unless the [owner]{@link module:enyo/Component~Component#owner} is explicitly specified, the new
		* component will be owned by the instance on which this method is called.
		*
		* @example
		* // Create a new component named 'dynamic', owned by 'this'
		* // (will be available as this.$.dynamic).
		* this.createComponent({name: 'dynamic'});
		*
		* @example
		* // Create a new component named 'another' owned by 'other'
		* // (will be available as other.$.another).
		* this.createComponent({name: 'another'}, {owner: other});
		*
		* @param {Object} props - The declarative [kind]{@glossary kind} definition.
		* @param {Object} ext - Additional properties to be applied (defaults).
		* @returns {module:enyo/Component~Component} The instance created with the given parameters.
		* @public
		*/
		createComponent: function (props, ext) {
			// createComponent and createComponents both delegate to the protected method
			// (_createComponent), allowing overrides to customize createComponent and
			// createComponents separately.
			return this._createComponent(props, ext);
		},

		/**
		* Creates [components]{@link module:enyo/Component~Component} as defined by the [arrays]{@glossary Array}
		* of base and additional property [hashes]{@glossary Object}. The standard and
		* additional property hashes are combined as described in
		* [createComponent()]{@link module:enyo/Component~Component#createComponent}.
		*
		* @example
		* // ask foo to create components 'bar' and 'zot', but set the owner of
		* // both components to 'this'.
		* this.$.foo.createComponents([
		*	{name: 'bar'},
		*	{name: 'zot'}
		* ], {owner: this});
		*
		* @param {Object[]} props The array of {@link module:enyo/Component~Component} definitions to be created.
		* @param {Object} ext - Additional properties to be supplied as defaults for each.
		* @returns {module:enyo/Component~Component[]} The array of [components]{@link module:enyo/Component~Component} that were
		*	created.
		* @public
		*/
		createComponents: function (props, ext) {
			var comps = [],
				comp,
				i;

			if (props) {
				for (i = 0; i < props.length; ++i) {
					comp = props[i];
					comps.push(this._createComponent(comp, ext));
				}
			}

			return comps;
		},

		/**
		* @private
		*/
		getBubbleTarget: function (nom, event) {
			if (event.delegate) return this.owner;
			else {
				return (
					this.bubbleTarget
					|| (this.cachedBubble && this.cachedBubbleTarget[nom])
					|| this.owner
				);
			}
		},

		/**
		* Bubbles an {@glossary event} up an [object]{@glossary Object} chain,
		* starting with `this`.
		*
		* A handler for an event may be specified. See {@link module:enyo/Component~Component~EventHandler}
		* for complete details.
		*
		* @param {String} nom - The name of the {@glossary event} to bubble.
		* @param {Object} [event] - The event [object]{@glossary Object} to be passed along
		* while bubbling.
		* @param {module:enyo/Component~Component} [sender=this] - The {@link module:enyo/Component~Component} responsible for
		*	bubbling the event.
		* @returns {Boolean} `false` if unhandled or uninterrupted; otherwise, `true`.
		* @public
		*/
		bubble: function (nom, event, sender) {
			if (!this._silenced) {
				event = event || {};
				event.lastHandledComponent = null;
				event.bubbling = true;
				// deliberately done this way
				if (event.originator == null) event.originator = sender || this;
				return this.dispatchBubble(nom, event, sender || this);
			}
			return false;
		},

		/**
		* Bubbles an {@glossary event} up an [object]{@glossary Object} chain,
		* starting **above** `this`.
		*
		* A handler for an event may be specified. See {@link module:enyo/Component~Component~EventHandler}
		* for complete details.
		*
		* @param {String} nom - The name of the {@glossary event}.
		* @param {Object} [event] - The event properties to pass along while bubbling.
		* @returns {Boolean} `false` if unhandled or uninterrupted; otherwise, `true`.
		* @public
		*/
		bubbleUp: function (nom, event) {
			var next;

			if (!this._silenced) {
				event = event || {};
				event.bubbling = true;
				next = this.getBubbleTarget(nom, event);
				if (next) {
					// use delegate as sender if it exists to preserve illusion
					// that event is dispatched directly from that, but we still
					// have to bubble to get decorations
					return next.dispatchBubble(nom, event, event.delegate || this);
				}
			}
			return false;
		},

		/**
		* Sends an {@glossary event} to a named [delegate]{@glossary delegate}.
		* This [object]{@glossary Object} may dispatch an event to
		* itself via a [handler]{@link module:enyo/Component~Component~EventHandler}, or to its
		* [owner]{@link module:enyo/Component~Component#owner} via an event property, e.g.:
		*
		*	handlers {
		*		// 'tap' events dispatched to this.tapHandler
		*		ontap: 'tapHandler'
		*	}
		*
		*	// 'tap' events dispatched to 'tapHandler' delegate in this.owner
		*	ontap: 'tapHandler'
		*
		* @private
		*/
		dispatchEvent: function (nom, event, sender) {
			var delegate,
				ret;

			if (!this._silenced) {
				// if the event has a delegate associated with it we grab that
				// for reference
				// NOTE: This is unfortunate but we can't use a pooled object here because
				// we don't know where to release it
				delegate = (event || (event = {})).delegate;

				// bottleneck event decoration w/ optimization to avoid call to empty function
				if (this.decorateEvent !== Component$2.prototype.decorateEvent) {
					this.decorateEvent(nom, event, sender);
				}

				// first, handle any delegated events intended for this object
				if (delegate && delegate.owner === this) {
					// the most likely case is that we have a method to handle this
					if (this[nom] && 'function' === typeof this[nom]) {
						return this.dispatch(nom, event, sender);
					}
					// but if we don't, just stop the event from going further
					return false;
				}

				// for non-delgated events, try the handlers block if possible
				if (!delegate) {
					var bHandler = this.handlers && this.handlers[nom];
					var bDelegatedFunction = this[nom] && utils$2.isString(this[nom]);
					var cachePoint = this.cachePoint || bHandler || bDelegatedFunction || this.id === "master" ;

					if (event.bubbling) {
						if (event.lastHandledComponent && cachePoint) {
							event.lastHandledComponent.cachedBubbleTarget[nom] = this;
							event.lastHandledComponent = null;
						}
						if (!event.lastHandledComponent && this.id !== "master") {
							event.lastHandledComponent = this;
						}
					}
					if (bHandler && this.dispatch(bHandler, event, sender)) {
						return true;
					}
					if (bDelegatedFunction) {
						// we dispatch it up as a special delegate event with the
						// component that had the delegation string property stored in
						// the 'delegate' property
						event.delegate = this;
						ret = this.bubbleUp(this[nom], event, sender);
						delete event.delegate;
						return ret;
					}
				}
			}
			return false;
		},

		/**
		* Internal - try dispatching {@glossary event} to self; if that fails,
		* [bubble it up]{@link module:enyo/Component~Component#bubbleUp} the tree.
		*
		* @private
		*/
		dispatchBubble: function (nom, event, sender) {
			if (!this._silenced) {
				// Try to dispatch from here, stop bubbling on truthy return value
				if (this.dispatchEvent(nom, event, sender)) {
					return true;
				}
				// Bubble to next target
				return this.bubbleUp(nom, event, sender);
			}
			return false;
		},

		/**
		* @private
		*/
		decorateEvent: function (nom, event, sender) {
			// an event may float by us as part of a dispatchEvent chain
			// both call this method so intermediaries can decorate inEvent
		},

		/**
		* @private
		*/
		stopAllJobs: function () {
			var job;

			if (this.__jobs) for (job in this.__jobs) this.stopJob(job);
		},

		/**
		* Dispatches the {@glossary event} to named [delegate]{@glossary delegate} `nom`,
		* if it exists. [Subkinds]{@glossary subkind} may re-route dispatches. Note that
		* both 'handlers' events and events delegated from owned controls arrive here.
		* If you need to handle these types of events differently, you may also need to
		* override [dispatchEvent()]{@link module:enyo/Component~Component#dispatchEvent}.
		*
		* @param {String} nom - The method name to dispatch the {@glossary event}.
		* @param {Object} [event] - The event [object]{@glossary Object} to pass along.
		* @param {module:enyo/Component~Component} [sender=this] - The originator of the event.
		* @public
		*/
		dispatch: function (nom, event, sender) {
			var fn;

			if (!this._silenced) {
				fn = nom && this[nom];
				if (fn && typeof fn == 'function') {
					// @todo: deprecate sender
					return fn.call(this, sender || this, event);
				}
			}
			return false;
		},

		/**
		* Triggers the [handler]{@link module:enyo/Component~Component~EventHandler} for a given
		* {@glossary event} type.
		*
		* @example
		* myControl.triggerHandler('ontap');
		*
		* @param {String} nom - The name of the {@glossary event} to trigger.
		* @param {Object} [event] - The event object to pass along.
		* @param {module:enyo/Component~Component} [sender=this] - The originator of the event.
		* @returns {Boolean} `false` if unhandled or uninterrupted, `true` otherwise.
		* @public
		*/
		triggerHandler: function () {
			return this.dispatchEvent.apply(this, arguments);
		},

		/**
		* Sends a message to myself and all of my [components]{@link module:enyo/Component~Component}.
		* You can stop a waterfall into components owned by a receiving object
		* by returning a truthy value from the {@glossary event}
		* [handler]{@link module:enyo/Component~Component~EventHandler}.
		*
		* @param {String} nom - The name of the {@glossary event} to waterfall.
		* @param {Object} [event] - The event [object]{@glossary Object} to pass along.
		* @param {module:enyo/Component~Component} [sender=this] - The originator of the event.
		* @returns {this} The callee for chaining.
		* @public
		*/
		waterfall: function(nom, event, sender) {
			if (!this._silenced) {
				event = event || {};
				event.bubbling = false;

				// give the locals an opportunity to interrupt the event
				if (this.dispatchEvent(nom, event, sender)) return true;

				// otherwise carry on
				this.waterfallDown(nom, event, sender || this);
			}

			return this;
		},

		/**
		* Sends a message to all of my [components]{@link module:enyo/Component~Component}, but not myself. You can
		* stop a [waterfall]{@link module:enyo/Component~Component#waterfall} into [components]{@link module:enyo/Component~Component}
		* owned by a receiving [object]{@glossary Object} by returning a truthy value from the
		* {@glossary event} [handler]{@link module:enyo/Component~Component~EventHandler}.
		*
		* @param {String} nom - The name of the {@glossary event}.
		* @param {Object} [event] - The event [object]{@glossary Object} to pass along.
		* @param {module:enyo/Component~Component} [sender=this] - The event originator.
		* @returns {this} The callee for chaining.
		* @public
		*/
		waterfallDown: function(nom, event, sender) {
			var comp;
			event = event || {};
			event.bubbling = false;

			if (!this._silenced) {
				for (comp in this.$) this.$[comp].waterfall(nom, event, sender || this);
			}

			return this;
		},

		/**
		* @private
		*/
		_silenced: false,

		/**
		* @private
		*/
		_silenceCount: 0,

		/**
		* Sets a flag that disables {@glossary event} propagation for this
		* [component]{@link module:enyo/Component~Component}. Also increments an internal counter that tracks
		* the number of times the [unsilence()]{@link module:enyo/Component~Component#unsilence} method must
		* be called before event propagation will continue.
		*
		* @returns {this} The callee for chaining.
		* @public
		*/
		silence: function () {
			this._silenced = true;
			this._silenceCount += 1;

			return this;
		},

		/**
		* Determines if the [object]{@glossary Object} is currently
		* [silenced]{@link module:enyo/Component~Component#_silenced}, which will prevent propagation of
		* [events]{@glossary event} (of any kind).
		*
		* @returns {Boolean} `true` if silenced; otherwise, `false`.
		* @public
		*/
		isSilenced: function () {
			return this._silenced;
		},

		/**
		* Allows {@glossary event} propagation for this [component]{@link module:enyo/Component~Component}
		* if the internal silence counter is `0`; otherwise, decrements the counter by one.
		* For event propagation to resume, this method must be called one time each call to
		* [silence()]{@link module:enyo/Component~Component#silence}.
		*
		* @returns {Boolean} `true` if the {@link module:enyo/Component~Component} is now unsilenced completely;
		*	`false` if it remains silenced.
		* @public
		*/
		unsilence: function () {
			if (0 !== this._silenceCount) --this._silenceCount;
			if (0 === this._silenceCount) this._silenced = false;
			return !this._silenced;
		},

		/**
		* Creates a new [job]{@link module:enyo/job} tied to this instance of the
		* [component]{@link module:enyo/Component~Component}. If the component is
		* [destroyed]{@link module:enyo/Component~Component#destroy}, any jobs associated with it
		* will be stopped.
		*
		* If you start a job with the same name as a pending job,
		* the original job will be stopped; this can be useful for resetting
		* timeouts.
		*
		* You may supply a priority level (1-10) at which the job should be
		* executed. The default level is `5`. Setting the priority lower than `5` (or setting it to
		* the string `"low"`) will defer the job if an animation is in progress,
		* which can help to avoid stuttering.
		*
		* @param {String} nom - The name of the [job]{@link module:enyo/job} to start.
		* @param {(Function|String)} job - Either the name of a method or a
		*	[function]{@glossary Function} to execute as the requested job.
		* @param {Number} wait - The number of milliseconds to wait before starting
		*	the job.
		* @param {Number} [priority=5] The priority value to be associated with this
		*	job.
		* @returns {this} The callee for chaining.
		* @public
		*/
		startJob: function (nom, job, wait, priority) {
			var jobs = (this.__jobs = this.__jobs || {});
			priority = priority || 5;
			// allow strings as job names, they map to local method names
			if (typeof job == 'string') job = this[job];
			// stop any existing jobs with same name
			this.stopJob(nom);
			jobs[nom] = setTimeout(this.bindSafely(function() {
				Jobs.add(this.bindSafely(job), priority, nom);
			}), wait);

			return this;
		},

		/**
		* Stops a [component]{@link module:enyo/Component~Component}-specific [job]{@link module:enyo/job} before it has
		* been activated.
		*
		* @param {String} nom - The name of the [job]{@link module:enyo/job} to be stopped.
		* @returns {this} The callee for chaining.
		* @public
		*/
		stopJob: function (nom) {
			var jobs = (this.__jobs = this.__jobs || {});
			if (jobs[nom]) {
				clearTimeout(jobs[nom]);
				delete jobs[nom];
			}
			Jobs.remove(nom);
		},

		/**
		* Executes the specified [job]{@link module:enyo/job} immediately, then prevents
		* any other calls to `throttleJob()` with the same job name from running for
		* the specified amount of time.
		*
		* @param {String} nom - The name of the [job]{@link module:enyo/job} to throttle.
		* @param {(Function|String)} job - Either the name of a method or a
		*	[function]{@glossary Function} to execute as the requested job.
		* @param {Number} wait - The number of milliseconds to wait before executing the
		*	job again.
		* @returns {this} The callee for chaining.
		* @public
		*/
		throttleJob: function (nom, job, wait) {
			var jobs = (this.__jobs = this.__jobs || {});
			// if we still have a job with this name pending, return immediately
			if (!jobs[nom]) {
				// allow strings as job names, they map to local method names
				if (typeof job == 'string') job = this[job];
				job.call(this);
				jobs[nom] = setTimeout(this.bindSafely(function() {
					this.stopJob(nom);
				}), wait);
			}
			return this;
		}
	});

	Component$2.prototype.defaultKind = Component$2;

	/**
	* @private
	*/
	kind$1.setDefaultCtor(Component$2);

	/**
	* Creates new instances from [config]{@glossary configurationBlock}
	* [objects]{@glossary Object}. This method looks up the proper
	* [constructor]{@glossary constructor} based on the provided [kind]{@glossary kind}
	* attribute.
	*
	* @name module:enyo/Compoment~Component.create
	* @param {Object} props - The properties that define the [kind]{@glossary kind}.
	* @returns {*} An instance of the requested [kind]{@glossary kind}.
	* @public
	*/
	Component$2.create = function (props) {
		var theKind,
			Ctor;

		if (!props.kind && props.hasOwnProperty('kind')) throw new Error(
			'enyo.create: Attempt to create a null kind. Check dependencies for [' + props.name + ']'
		);

		theKind = props.kind || props.isa || kind$1.getDefaultCtor();
		Ctor = kind$1.constructorForKind(theKind);

		if (!Ctor) {
			logger.error('No constructor found for kind ' + theKind);
			Ctor = Component$2;
		}

		return new Ctor(props);
	};

	/**
	* @name module:enyo/Component~Component.subclass
	* @static
	* @private
	*/
	Component$2.subclass = function (ctor, props) {
		// Note: To reduce API surface area, sub-components are declared only as
		// 'components' in both kind and instance declarations.
		//
		// However, 'components' from kind declarations must be handled separately
		// at creation time.
		//
		// We rename the property here to avoid having
		// to interrogate the prototype at creation time.
		//
		var proto = ctor.prototype;
		//
		if (props.components) {
			proto.kindComponents = props.components;
			delete proto.components;
		} else {
			// Feature to mixin overrides of super-kind component properties from named hash
			// (only applied when the sub-kind doesn't supply its own components block)
			if (props.componentOverrides) {
				proto.kindComponents = Component$2.overrideComponents(
					proto.kindComponents,
					props.componentOverrides,
					proto.defaultKind
				);
			}
		}
	};

	/**
	* @name module:enyo/Component~Component.concat
	* @static
	* @private
	*/
	Component$2.concat = function (ctor, props) {
		var proto = ctor.prototype || ctor,
			handlers;
		if (props.handlers) {
			handlers = proto.handlers ? utils$2.clone(proto.handlers) : {};
			proto.handlers = utils$2.mixin(handlers, props.handlers);
			delete props.handlers;
		}
		if (props.events) Component$2.publishEvents(proto, props);
	};

	/**
	* @name module:enyo/Component~Component.overrideComponents
	* @static
	* @private
	*/
	Component$2.overrideComponents = function (components, overrides, defaultKind) {
		var omitMethods = function (k, v) {
			var isMethod = 
				// If it's a function, then it's a method (unless it's
				// a constructor passed as value for 'kind')
				(utils$2.isFunction(v) && (k !== 'kind')) ||
				// If it isInherited(), then it's also a method (since
				// Inherited is an object wrapper for a function)
				kind$1.isInherited(v);

			return !isMethod;
		};
		components = utils$2.clone(components);
		for (var i=0; i<components.length; i++) {
			var c = utils$2.clone(components[i]);
			var o = overrides[c.name];
			var ctor = kind$1.constructorForKind(c.kind || defaultKind);
			if (o) {

				// NOTE: You cannot overload mixins, observers or computed properties from
				// component overrides
				kind$1.concatHandler(c, o);
				var b = (c.kind && ((typeof c.kind == 'string' && utils$2.getPath(c.kind)) || (typeof c.kind == 'function' && c.kind))) || kind$1.getDefaultCtor();
				while (b) {
					if (b.concat) { b.concat(c, o, true); }
					b = b.prototype.base;
				}
				// All others just mix in
				utils$2.mixin(c, o, {filter: omitMethods});
			}
			if (c.components) {
				c.components = Component$2.overrideComponents(c.components, overrides, ctor.prototype.defaultKind);
			}
			components[i] = c;
		}
		return components;
	};

	/**
	* @name module:enyo/Component~Component.publishEvents
	* @static
	* @private
	*/
	Component$2.publishEvents = function (ctor, props) {
		var events = props.events,
			event,
			proto;
		if (events) {
			proto = ctor.prototype || ctor;
			for (event in events) Component$2.addEvent(event, events[event], proto);
		}
	};

	/**
	* @name module:enyo/Component~Component.addEvent
	* @static
	* @private
	*/
	Component$2.addEvent = function (nom, val, proto) {
		var v, fn;
		if (!utils$2.isString(val)) {
			v = val.value;
			fn = val.caller;
		} else {
			if (nom.slice(0, 2) != 'on') {
				logger.warn('enyo/Component.addEvent: event names must start with "on". ' + proto.kindName + ' ' +
					'event "' + nom + '" was auto-corrected to "on' + nom + '".');
				nom = 'on' + nom;
			}
			v = val;
			fn = 'do' + utils$2.cap(nom.slice(2));
		}
		proto[nom] = v;
		if (!proto[fn]) {
			proto[fn] = function(payload, other) {
				// bubble this event

				// if the second parameter exists then we use that - this is for a single case
				// where a named event delegates happent to point to an auto generated event
				// bubbler like this one - in that case the first parameter is actually the
				// sender
				var e = other || payload;
				if (!e) {
					e = {};
				}
				var d = e.delegate;
				// delete payload.delegate;
				e.delegate = undefined;
				if (!utils$2.exists(e.type)) {
					e.type = nom;
				}
				this.bubble(nom, e);
				if (d) {
					e.delegate = d;
				}
			};
		}
	};

	/**
	* @private
	*/
	function prefixFromKindName (nom) {
		var pre = kindPrefix[nom],
			last;

		if (!pre) {
			last = nom.lastIndexOf('.');
			pre = (last >= 0) ? nom.slice(last+1) : nom;
			pre = pre.charAt(0).toLowerCase() + pre.slice(1);
			kindPrefix[nom] = pre;
		}

		return pre;
	}

	var ComponentExports = Component$3.exports;

	var Signals$2 = {exports: {}};

	/**
	* Contains the declaration for the {@link module:enyo/Signals~Signals} kind.
	* @module enyo/Signals
	*/

	var
		kind = kindExports,
		utils$1 = utils$a;

	var
		Component$1 = ComponentExports;

	/**
	* {@link module:enyo/Signals~Signals} is a [component]{@link module:enyo/Component~Component} used to listen
	* to global messages.
	* 
	* An object with a Signals component can listen to messages sent from anywhere
	* by declaring handlers for them.
	* 
	* DOM [events]{@glossary event} that have no node targets are broadcast as
	* signals. These events include Window events, such as `onload` and
	* `onbeforeunload`, as well as events that occur directly on `document`, such
	* as `onkeypress` if `document` has the focus.
	* 
	* For more information, see the documentation on [Event
	* Handling]{@linkplain $dev-guide/key-concepts/event-handling.html} in the
	* Enyo Developer Guide.
	*
	* @class Signals
	* @extends module:enyo/Component~Component
	* @public
	*/
	var Signals$1 = Signals$2.exports = kind(
		/** @lends module:enyo/Signals~Signals.prototype */ {

		name: 'enyo.Signals',

		/**
		* @private
		*/
		kind: Component$1,

		/**
		* Needed because of early calls to bind DOM {@glossary event} listeners
		* to the [enyo.Signals.send()]{@link module:enyo/Signals~Signals#send} call.
		* 
		* @private
		*/


		/**
		* @method
		* @private
		*/
		create: kind.inherit(function (sup) {
			return function() {
				sup.apply(this, arguments);
				Signals$1.addListener(this);
			};
		}),

		/**
		* @method
		* @private
		*/
		destroy: kind.inherit(function (sup) {
			return function() {
				Signals$1.removeListener(this);
				sup.apply(this, arguments);
			};
		}),

		/**
		* @private
		*/
		notify: function (msg, load) {
			this.dispatchEvent(msg, load);
		},

		/**
		* @private
		*/
		protectedStatics: {
			listeners: [],
			addListener: function(listener) {
				this.listeners.push(listener);
			},
			removeListener: function(listener) {
				utils$1.remove(listener, this.listeners);
			}
		},

		/**
		* @private
		*/
		statics: 
			/** @lends module:enyo/Signals~Signals.prototype */ {

			/**
			* Broadcasts a global message to be consumed by subscribers.
			* 
			* @param {String} msg - The message to send; usually the name of the
			*	{@glossary event}.
			* @param {Object} load - An [object]{@glossary Object} containing any
			*	associated event properties to be accessed by subscribers.
			* @public
			*/
			send: function (msg, load) {
				utils$1.forEach(this.listeners, function(l) {
					l.notify(msg, load);
				});
			}
		}
	});

	var SignalsExports = Signals$2.exports;

	var
		utils = utils$a;
	var
		Component = ComponentExports,
		Signals = SignalsExports;

	/**
	* Default owner assigned to ownerless [UiComponents]{@link module:enyo/UiComponent~UiComponent},
	* to allow such UiComponents to be notified of important system events like window resize.
	*
	* NOTE: Ownerless [UiComponents]{@link module:enyo/UiComponent~UiComponent} will not be garbage collected unless 
	* explicitly destroyed, as they will be referenced by `master`.
	*
	* @module enyo/master
	* @private
	*/
	var master = new Component({
		name: 'master',
		notInstanceOwner: true,
		eventFlags: {showingOnly: true}, // don't waterfall these events into hidden controls
		getId: function () {
			return '';
		},
		isDescendantOf: utils.nop,
		bubble: function (nom, event) {
			//enyo.log('master event: ' + nom);
			if (nom == 'onresize') {
				// Resize is special; waterfall this message.
				// This works because master is a Component, so it waterfalls
				// to its owned Components (i.e., master has no children).
				master.waterfallDown('onresize', this.eventFlags);
				master.waterfallDown('onpostresize', this.eventFlags);
			} else {
				// All other top-level events are sent only to interested Signal
				// receivers.
				Signals.send(nom, event);
			}
		}
	});

	return buildEntry;

})();
