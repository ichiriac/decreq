/*!
 * DecReq - A minimalistic dependency and modules layer
 * @author Ioan CHIRIAC
 * @see https://github.com/ichiriac/decreq
 * @license MIT
 */

if (typeof DEBUG_DECREQ === 'undefined') DEBUG_DECREQ = false;
DEBUG_DECREQ && console.log('start deq req');

// require helper
var require = function require(modules, closure) {
	if (!require.options._started) {
	  return [modules, closure];
	}
	if (typeof modules == 'string') {
		modules = [modules];
	}
	var wait = new Array();
	for(var m = 0; m < modules.length; m++) {
		var module = modules[m];
		if ( typeof require.modules[module] === 'undefined' ) {
			// push to wait
			wait.push(module);
		}
	}
	if ( wait.length > (window.IE ? 1 : 0)) {
		// lazy load items
		require.options.debug && console.log('require : ' + wait.join(', '));
		var result = {
			_handler: null,
			_depends: wait,
			_timer: setTimeout(function() {
				require.options.load(wait, function() {
					var definition = {};
					if (typeof closure == 'function') definition = closure(require.options.context);
					if (typeof result._handler == 'function') result._handler(definition);
			  });
			})
		};
		return result;
	} else {
		// everything is already loaded so lets go
		return (typeof closure == 'function' && closure(require.options.context)) || closure;
	}
};
/**
 * Registers a module
 */
require.register = function(module, definition) {
	require.modules[module] = definition;
	if (require.options._loading.hasOwnProperty(module)) {
		delete require.options._loading[module];
	}
	var parts = module.split(/\./g);
	var target = require.options.context;
	for(var i =0; i < parts.length; i++) {
		var ns = parts[i];
		if (typeof ns !== 'string') continue;
		if (typeof target[ns] === 'undefined') {
			target[ns] = {};
		}
		if ( i < parts.length - 1) {
			target = target[ns];
		}
	}
	require.options.debug && console.log('register ' + module, definition);
	if ( typeof definition === 'function') {
		target[ns] = definition;
	} else {
		for(var prop in definition) {
			target[ns][prop] = definition[prop];
		}
	}
	require.options._stack.trigger(module);
};
// loads an external ressource
require.load = function(target, type, callback) {
	var e;
	if ( !type ) {
		type = target.substring(target.length - 3, target.length) == '.js' ? 'js' : 'css';
	}
	if (target instanceof Array ) {
	  for(var i = 0; i < target.length; i++) {
		e = this.load(target[i]);
		e.async=false;
	  }
	  if (e && typeof type === 'function') e.onload = type;
	} else {
		if ( type === 'css') {
			e=document.createElement('link');
			e.rel='stylesheet';
			e.type='text/css';
			e.href = target;
	  } else {
			e=document.createElement('script');
			e.src=target;
			e.crossorigin='anonymous';
			e.async=true;
		}
		if (callback) e.onload = callback;
		(document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(e);
	}
	return e;
};
// options
require.options = {
	path: '/',
	map: {},
	context: {},
	variant: false,
	debug: DEBUG_DECREQ,
	_started: false,
	_pending: {},
	_loading: {},
	_stack: {
		scripts: {},
		listeners: new Array(),
		trigger: function(module) {
			require.options.debug && console.group('Trigger ' + module);
			for(var i =0; i < this.listeners.length; i++) {
				var l = this.listeners[i];
				if ( l.wait > 0 && l.modules ) {
					if (l.modules.indexOf(module) > -1) {
						this.listeners[i].wait --;
						if ( this.listeners[i].wait < 1 ) {
							require.options.debug && console.log('listener ready with ', l.modules);
							if (typeof l.callback == 'function') l.callback();
						}
					}
				}
			}
			require.options.debug && console.groupEnd();
		}
	},
	load: function(modules, cb) {
		var expect = [];
		for(var m = 0; m < modules.length; m++) {
			if ( typeof require.modules[modules[m]] === 'undefined' ) {
				expect.push(modules[m]);
			}
		}
		if (expect.length === 0) {
			return cb();
		}
		this._stack.listeners.push({
			modules: expect,
			wait: window.IE ? expect.length - 1 : expect.length,
			callback: cb
		});
		for(var m = 0; m < expect.length; m++) {
			var module = expect[m];
			if(typeof module != 'string') continue;
			// is already requested ignore it's load
			if (require.options._loading.hasOwnProperty(module)) {
				continue;
			}
			// is pending to be declared - lazy declare
			var call = require.options._pending[module];
			if(typeof call !== 'undefined' && call) {
				if (Array.isArray(call)) {
					declare(module, require(call[0], call[1]));
				} else {
					declare(module, call);
				}
				continue;
			}
			var assets = this.finder(module);
			if (assets) {
				if (typeof assets == 'string') assets = [assets];
			} else {
				result._context[module] = require.modules[module] = {};
				console.error('Unable to locate module ' + module);
			}
			for(var a =0; a < assets.length; a++) {
				var file = assets[a];
				if (typeof file != 'string') continue;
				if (file.substring(file.length - 3) == 'css') {
					this.css(file);
				} else {
					if (typeof this._stack.scripts[file] === 'undefined') {
						this._stack.scripts[file] = this.js(file);
						this._stack.scripts[file].module = module;
						this._stack.scripts[file].onerror = function() {
							console.error('The module ['+this.module+'] could not be loaded !');
							declare(this.module, function() {
								return {};
							});
						};
						// checks if the module timeout (2 sec)
						this._stack.scripts[file].timeout = setTimeout(function(module) {
							if (module && typeof require.modules[module] == 'undefined') {
								console.warn('Module ' + module + ' timeout (wait 5sec) !');
								declare(module, function() {
									return {};
								});
							}
						}, 2000, module);
						// checks if the module is defined
						this._stack.scripts[file].onload = function() {
							if (this.timeout) {
								clearTimeout(this.timeout);
							}
							setTimeout(function(module) {
								if (module && typeof require.modules[module] == 'undefined') {
									console.warn('Module ' + module + ' not defined !');
									declare(module, function() {
										return {};
									});
								}
							}, 10000, this.module);
						};
					}
				}
			}
		}
	},
	js: function(target, callback) {
		if (this.variant) target += '?v=' + this.variant;
		return require.load(this.path + target, 'js', callback);
	},
	css: function(target) {
		if ( this.variant ) target += '?v=' + this.variant;
		return require.load(this.path + target, 'css');
	},
	finder: function(module) {
		if ( typeof this.map[module] !== 'undefined') {
			return this.map[module];
		} else {
			return module.replace(/\./g, '/') + '.js';
		}
	}
};
require.modules = {};
// configuration helper
require.configure = function(options) {
	for(var i in options) {
		require.options[i] = options[i];
	}
	return require;
};
require.start = function() {
	require.options._started = true;
	if (arguments.length > 0) {
		return require.apply(require, arguments);
	} else {
		return require;
	}
};

// declaring a module
var declare = function declare(module, closure) {
	if (!require.options._started) {
		require.options.debug && console.log('pending ' + module);
		require.options._pending[module] = closure;
		return;
	} else if (require.options._pending.hasOwnProperty(module)) {
		require.options.debug && console.log('release ' + module);
		delete require.options._pending[module];
	}
	require.options._loading[module] = true;
	
	//@debug
	if (require.options.debug && typeof require.modules[module] !== 'undefined') {
		console.error('Module ' + module + ' is already defined !');
		console.info(closure);
	}
	//@end
	require.options.debug && console.log('declare ' + module);
	if (typeof closure == 'function') {
		require.register(
			module,
			closure(require.options.context)
		);
	} else if ( typeof closure._handler != 'undefined' ) {
		require.options.debug && console.log(module, 'expect modules ', closure._depends);
		for(var i=0; i < require.options._stack.scripts.length; i++) {
			var def = require.options._stack.scripts[i];
			if ( def.module == module && def.timeout ) {
				clearTimeout(def.timeout);
				def.timeout = null;
			}
		}
		closure._handler = function(definition) {
			require.register(module, definition);
		};
	} else {
		require.register(module, closure);
	}
};
