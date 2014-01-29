DecReq (Declare & Require)
=========================

A minimalistic implementation (200 lines of code approx) of assets management and dependencies throw closured declarations

# Usage

## declare(name, closure)

This function declares a module. The closure is called for initialize the module
and the module definition is returned by the closure

## require(modules, closure)

This function is used to require a list of modules. When they are loaded, the
specified closure is executed with the list of modules passed as a context parameter.

```
TIP : require can be used as the closure for the declare function, that handles dependencies
```

## require.configure(options)

Configures the require layer with the following options :

 * path : Location root of assets
 * variant : A variant used to flush cache
 * context : A pre-initialized context (with parameters passed to each module like a global) 
 * map : Definition of modules and ressources (js or css) - for loading a package of ressources
 * finder : A closure that automatically converts a module name into a list of ressources - by default converts each "." into a "/"

# Sample

## The bootstrap
```js
require.configure({
    path: 'http://your-domain.com/js/',
    variant: 1,
    context: {
        'var1': 'foobar'
    }
});
require('bar', function(context) {
  // when bar is ready execute this :
  context.bar.say();
});
```

## http://your-domain.com/js/bar.js
```js
declare(
    'bar',
    // bar depends on foo package 
    require(['foo'], function(context) {
        // when foo is ready, define the bar structure
        return {
            say: function() {
                console.log('hello from bar');
                context.foo.do();
            }
        };
    })
);
```


## http://your-domain.com/js/foo.js
```js
declare(
    'foo',
    function(context) {
        return {
            do: function() {
                console.log('do something from foo - and show context var1 = ' + context.var1);
            }
        };
    }
);
```

# Compressing the JS

If you use RecReq without any compression method, you will load a file for 
each package, and could result to a slower load. 

Then you could minify and use a single js file that contains every declaration. 
For a single compressed file that contains every declaration that satisfy 
dependencies, you have nothing to configure in DepReq, it's just works 
out of the box.

In that case if a dependency is required and not declared into the initial 
compressed file, the system willload it from it's external source like it 
does habitually.

Take a look at UglifyJS2 (https://github.com/mishoo/UglifyJS2) that a great tool 
and works perfectly with DepReq, even with the mangle mode.
