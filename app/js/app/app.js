define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',

    'vent',

    'app/views/globe',
    'app/views/routeChart',
    'app/views/planeChart'
], function(
    $,
    _,
    Backbone,
    Marionette,

    vent,

    globeView,
    RouteChartView,
    PlaneChartView
    ){

    var app = new Marionette.Application();

    app.addRegions({
        "routeChart":'.route-chart',
        "canvas":".canvas",
        "plane_chart":".plane-chart",
        "control":".control"
    });

    app.canvas.show(globeView);

    var planeChartView = new PlaneChartView();
    app.plane_chart.show(planeChartView);


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