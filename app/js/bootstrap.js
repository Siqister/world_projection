require.config({
    paths:{
        'jquery':'app/lib/jquery/jquery-1.11.0.min', //AMD
        'jquery-ui':'app/lib/jquery-ui/jquery-ui-1.10.4.custom.min',
        'underscore':'app/lib/underscore/underscore-min', //AMD
        'backbone':'app/lib/backbone/backbone-min', //AMD
        'backbone.wreqr':'app/lib/backbone/backbone.wreqr.min',
        'backbone.babysitter':'app/lib/backbone/backbone.babysitter.min',
        'marionette':'app/lib/backbone/backbone.marionette.min',

        'd3':'app/lib/d3/d3.min', //AMD
        'queue':'app/lib/queue/queue.v1.min',
        'topojson':'app/lib/topojson/topojson.v1.min',

        'vent':'app/vent'
    },
    shim:{
        'jquery-ui':['jquery']
    }
});

require([
    'app/app'
], function(
    App
){
    App.start();
});