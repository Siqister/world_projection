define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'd3',

    'vent'
],function(
    $,
    _,
    Backbone,
    Marionette,
    d3,

    vent
){
    var format = d3.format('.0f');

    var RouteChartView = Marionette.ItemView.extend({
       tableTemplate: _.template($('#table-template').html()),
       summaryTemplate: _.template($('#summary-template').html()),
       className:'route-chart-inner',
       initialize: function(options){
           //perform summary calculations
           this.data = {};
           this.data.iata = options.city;
           this.data.city = _.findWhere(options.airports, {"iata":options.city});
           this.data.airports = options.airports; //list of all airports
           var originCity = this.data.city;

           //reduce the list of routes
           this.data.routes = options.routes.filter(function(_r){
               return _r.dest !== options.city && _r.codeshare !== "Y";
           });
           this.data.routes.forEach(function(_r){
              var destCity = _.findWhere(options.airports,{"iata":_r.dest});
              if(!destCity){
                  console.log("error: " + _r.dest);
                  return;
              }

              var distanceRad = d3.geo.distance([originCity.lng, originCity.lat],[destCity.lng,destCity.lat]);

              _r.destCity = destCity.city + ', ' + destCity.country;
              _r.distance = distanceRad * 6371;
              _r.distString = format(_r.distance) + "km";
           })
           this.data.routes.sort(function(a,b){
              return b.distance - a.distance;
           });
       },
       render: function(){
           var that = this;
           this.$el.append(this.summaryTemplate(this.data.city));
           this.$el.append(this.tableTemplate({routes: this.data.routes})).fadeIn();

           //bind events directly to <tr>
           this.$('table tr').on('mouseenter',function(e){
               e.stopPropagation();
               var destIata = $(this).find('.dest-iata').attr("id");
               vent.trigger("route:hover", that.data.iata, destIata);

           })
           this.$('table').on('mouseleave', function(e){
               vent.trigger("route:out");
           });
       }
    });

    return RouteChartView;
});