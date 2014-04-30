/*!
 * DecReq - A minimalistic dependency and modules layer
 * @author Ioan CHIRIAC
 * @see https://github.com/ichiriac/decreq
 * @license MIT
 */
if (typeof DEBUG === 'undefined') DEBUG = false;
DEBUG && console.log('start deq req');

// require helper
var require = function require(modules, closure) {
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
        DEBUG && console.log('require : ' + wait.join(', '));
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
    if ( typeof definition === 'function') {
        DEBUG && console.log('register ' + module + ' function');
        target[ns] = definition;
    } else {
        DEBUG && console.log('register ' + module, definition);
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
        listeners: new Array(),
        trigger: function(module) {
            DEBUG && console.log('ready ' + module);
            do {
                var found = false;
                for(var i =0; i < this.listeners.length; i++) {
                    var l = this.listeners[i];
                    if ( l.modules ) {
                        if (l.modules.indexOf(module) > -1) {
                            this.listeners[i].wait --;
                            if ( this.listeners[i].wait < 1 ) {
                                DEBUG && console.log('listener ready with ', l.modules);
                                found = true;
                                this.listeners.splice(i, 1);
                                if (typeof l.callback == 'function') l.callback();
                                break;
                            }
                        }
                    }
                }
            } while(found);
        }
    },
    load: function(modules, cb) {
        this._stack.listeners.push({
            modules: modules,
            wait: window.IE ? modules.length - 1 : modules.length,
            callback: cb
        });
        for(var m = 0; m < modules.length; m++) {
            var module = modules[m];
            if(typeof module != 'string') continue;
            var assets = this.finder(module);
            if ( assets ) {
                if ( typeof assets == 'string') assets = [assets];
            } else {
                result._context[module] = require.modules[module] = {};
                console.error('Unable to locate module ' + module);
            }
            for(var a =0; a < assets.length; a++) {
                var file = assets[a];
                if(typeof file != 'string') continue;
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
};
// declaring a module
var declare = function declare(module, closure) {
    DEBUG && console.log('declare ' + module);
    //@debug
    if (typeof require.modules[module] !== 'undefined') {
        console.error('Module ' + module + ' is already defined !');
        DEBUG && console.info(closure);
    }
    //@end
    if (typeof closure == 'function') {
        require.register(
            module,
            closure(require.options.context)
        );
    } else if ( typeof closure._handler != 'undefined' ) {
        DEBUG && console.log('pending ' + module, closure);
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
