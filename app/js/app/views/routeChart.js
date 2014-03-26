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
       tableRowTemplate: _.template($('#table-row-template').html()),
       summaryTemplate: _.template($('#summary-template').html()),
       className:'route-chart-inner',
       initialize: function(options){
           var that = this,
               connectedAirports = []; //array containing data for connected airports

           this.data = {};

           this.data.iata = options.city; //origin city, IATA
           this.data.city = _.findWhere(options.airports, {"iata":options.city}); //origin city, full data
           this.data.airports = options.airports; //all airports, full data
           var originCity = this.data.city;


           //reduce the list of routes
           var rawRoutes = options.routes.filter(function(_r){
               //remove routes ending in origin city
               return _r.dest !== options.city;
           });
           //collapse multiple airlines serving same city
           this.data.routes = [];
           rawRoutes.forEach(function(_rawRoute){
               var existingRoute = _.findWhere(that.data.routes,{"dest":_rawRoute.dest});
               //if no existing route exists
               if(!existingRoute){
                   that.data.routes.push(_rawRoute);
               }else{
                   //concat airline and equipment
                   existingRoute.equipment = existingRoute.equipment.concat(_rawRoute.equipment);
                   existingRoute.airline = existingRoute.airline.concat(_rawRoute.airline);
               }
           });

           //calculate distance for each route
           this.data.routes.forEach(function(_r){
              var destCity = _.findWhere(options.airports,{"iata":_r.dest});
              if(!destCity){
                  console.log("error: " + _r.dest);
                  return;
              }
              connectedAirports.push(destCity);

              var distanceRad = d3.geo.distance(originCity.loc,destCity.loc);

              _r.destCity = destCity.city + ', ' + destCity.country;
              _r.destFullData = destCity;
              _r.distance = distanceRad * 6371;
              _r.distString = format(_r.distance) + "km";
              _r.equipment = _.uniq(_r.equipment);
           })
           //sort routes by distance
           this.data.routes = _.reject(that.data.routes,function(_r){
              return !(_r.destCity);
           });
           this.data.routes.sort(function(a,b){
              return b.distance - a.distance;
           });


           //calculate summary stats for the airports
           that.data.city.numAirports = _.pluck(connectedAirports,'iata').length;
           that.data.city.numCities = _.uniq(_.pluck(connectedAirports,'city')).length;
           that.data.city.numCountries = _.uniq(_.pluck(connectedAirports,'country')).length;
       },
       render: function(){
           var that = this;
           this.$el.append(this.summaryTemplate(this.data.city));
           this.$el.append(this.tableTemplate({routes: this.data.routes})).fadeIn();

           //render individual rows
           d3.select(that.el).select('tbody')
               .selectAll('.route-row')
               .data(that.data.routes)
               .enter()
               .append('tr')
               .attr('class','route-row dest-iata')
               .attr('id',function(d){
                   return d.dest;
               })
               .each(function(d){
                    $(this).append(that.tableRowTemplate(d));
               })
               .on('mouseenter',function(d){
                   d3.event.stopPropagation();
                   //TODO: trigger route:out to clear previous
                   vent.trigger("route:out");
                   vent.trigger("route:hover",[d.dest], d.equipment);
               });

           //bind events directly to <tr>
           that.$('table').on('mouseleave', function(e){
               vent.trigger("route:out");
           });
       },
       onShow: function(){
           var that = this,
               airportHover = null;

           //listen to airport hover events emitted from the globe
           vent.off("airport:hover")
               .on("airport:hover", function(destIata){
                   if(airportHover !== destIata){
                       airportHover = destIata;

                       var $highlight = that.$('table').find('#'+destIata).first();

                       that.scrollTo($highlight.offset().top - that.$el.offset().top);
                       $highlight.addClass('airport-hover');

                   }else{
                       return;
                   }
               });

           vent.off("airport:out")
               .on("airport:out", function(){
                   that.$('tr').removeClass('airport-hover');
               });
       },
       scrollTo: function(offset){
           var that = this;
           //not really legal
           $('.route-chart')
               .stop()
               .animate({
                    scrollTop: offset
               });
       }

    });

    return RouteChartView;
});