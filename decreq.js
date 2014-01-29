/*!
 * DecReq - A minimalistic dependency and modules layer
 * @author Ioan CHIRIAC
 * @see https://github.com/ichiriac/decreq
 * @license MIT
 */

// require helper
var require = function require(modules, closure) {
    if (typeof modules == 'string') {
        modules = [modules];
    }
    var wait = [];
    for(var m in modules) {
        var module = modules[m];
        if ( typeof require.modules[module] === 'undefined' ) {
            // push to wait
            wait.push(module);
        }
    }
    if ( wait.length > 0) {
        // lazy load items
        console.log('require ', wait);
        var result = {
            _handler: null
        };
        require.options.load(wait, function() {
            var definition = {};
            if (typeof closure == 'function') definition = closure(require.options.context);
            if (typeof result._handler == 'function') result._handler(definition);
        });
        return result;
    } else {
        // everything is already loaded so lets go
        return (typeof closure == 'function' && closure(require.options.context)) || closure;
    }
};
require.register = function(module, definition) {
    require.modules[module] = definition;

    var parts = module.split(/\./g);
    var target = require.options.context;
    for(var i in parts) {
        var ns = parts[i];
        if (typeof target[ns] === 'undefined') {
            target[ns] = {};
        }
        if ( i < parts.length - 1) {
            target = target[ns];
        }
    }
    if ( typeof definition === 'function') {
        console.log('register ' + module + ' function');
        target[ns] = definition;
    } else {
        console.log('register ' + module, definition);
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
        type = target.substring(-3) == '.js' ? 'js' : 'css';
    }
    if ( type === 'css') {
        e=document.createElement('link');
        e.rel='stylesheet';
        e.type='text/css';
        e.href = target;
    } else {
        e=document.createElement('script');
        e.src=target;
        e.async=true;
    }
    if (callback) e.onload = callback;
    (document.getElementsByTagName('head')[0]
    || document.getElementsByTagName('body')[0]
    ).appendChild(e);
    return e;
};
// options
require.options = {
    path: '/',
    map: {},
    context: {},
    variant: false,
    _stack: {
        scripts: {},
        listeners: [],
        trigger: function(module) {
            console.log('ready ' + module);
            for(var i in this.listeners) {
                var l = this.listeners[i];
                if ( l.modules.indexOf(module) > -1 ) {
                    l.wait -= 1;
                    if ( l.wait < 1 ) {
                        console.log('listener ready with ', l.modules);
                        if (typeof l.callback == 'function') l.callback();
                        delete this.listeners[i];
                    }
                }
            }
        }
    },
    load: function(modules, cb) {
        this._stack.listeners.push({
            modules: modules,
            wait: modules.length,
            callback: cb
        });
        for(var i in modules) {
            var module = modules[i];
            var assets = this.finder(module);
            if ( assets ) {
                if ( typeof assets == 'string') assets = [assets];
            } else {
                result._context[module] = require.modules[module] = {};
                console.error('Unable to locate module ' + module);
            }
            for(var i in assets) {
                var file = assets[i];
                if (file.substring(file.length - 3) == 'css') {
                    this.css(file);
                } else {
                    if ( typeof this._stack.scripts[file] === 'undefined') {
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
                            if (typeof require.modules[module] == 'undefined') {
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
                                if (typeof require.modules[module] == 'undefined') {
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
};
// declaring a module
var declare = function declare(module, closure) {
    console.log('declare ' + module);
    //@debug
    if (typeof require.modules[module] !== 'undefined') {
        console.error('Module ' + module + ' is already defined !');
        console.info(closure);
    }
    //@end
    if (typeof closure == 'function') {
        require.register(
            module,
            closure(require.options.context)
        );
    } else if ( typeof closure._handler != 'undefined' ) {
        console.log('pending ' + module, closure);
        for(var i in require.options._stack.scripts) {
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
