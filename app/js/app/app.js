define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',

    'vent',

    'app/views/globe',
    'app/views/routeChart'
], function(
    $,
    _,
    Backbone,
    Marionette,

    vent,

    globeView,
    RouteChartView
    ){

    var app = new Marionette.Application();

    app.addRegions({
        "routeChart":'.route-chart',
        "canvas":".canvas",
        "plane_chart":".plane-chart",
        "control":".control"
    });

    app.canvas.show(globeView);

    vent.on('city:picked', function(routes,airports,city){
        var routeChartView = new RouteChartView({
           "routes":routes,
           "airports":airports,
           "city": city
        });

        app.routeChart.show(routeChartView);
    });

    return app;
});