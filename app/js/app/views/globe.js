define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',

    'vent',

    'd3',
    'queue',
    'topojson',

    'jquery-ui'
],function(
    $,
    _,
    Backbone,
    Marionette,

    vent,

    d3,
    queue,
    topojson
){
    //Variables internal to the view
    var routes, airports;

    var margin = {t: 50, r: 50, b: 50, l: 50},
        width = $('.canvas').innerWidth() - margin.l - margin.r,
        height = $('.canvas').innerHeight() - margin.t - margin.b;

    var format = d3.format('.0f');

    var projection = d3.geo.azimuthalEquidistant()
        .scale(120)
        .translate([width/2, height/2])
        .rotate([71, -42.358431, 0])
        .clipAngle(180 - 1e-3)
        .precision(.1);

    var path = d3.geo.path()
        .projection(projection);

    var graticule = d3.geo.graticule();

    var tooltipTemplate = _.template('<%= name %> (<%= iata %>)<br /><span><%= city%>, <%= country%></span>');

    var angle = 0, //transformation angle of the distance readout
        center = 'BOS', //IATA code of current center city
        route_w_city = []; //route data connected to center

    //View definition
    var GlobeView = Marionette.ItemView.extend({
        className:'canvas-inner',
        render: function(){
            //overrides the requirement for a template
        },
        onShow: function(){
            var svg = d3.select(this.el).append('svg')
                .attr('width', width + margin.l + margin.r)
                .attr('height', height + margin.t + margin.b);

            var canvas = svg.append('g')
                .attr('class', 'canvas')
                .attr('transform', 'translate(' + margin.l + ',' + margin.t + ')')
                .on('click', function () {
                    //location --> location of mouse click
                    //if mouse click is on a connected airport, center map on the new airport
                    var target = d3.select(d3.event.toElement),
                        pickedCity = target.classed('connected')? target.datum():null;
                    d3.event.stopPropagation();

                    if(pickedCity){
                        changeCity(pickedCity.iata);
                    }
                })
                .on('mousemove',function(){
                    var target = d3.select(d3.event.toElement),
                        pickedCity = target.classed('connected')||target.classed('center')? target.datum():null;

                    //if mousemove target is a highlighted airport, show tooltip
                    if(pickedCity){
                        $('.custom-tooltip').css({
                            'left':d3.event.x + 10 + 'px',
                            'top':d3.event.y + 10 + 'px'
                        });
                        $('.custom-tooltip').html(tooltipTemplate(pickedCity));

                        //emit event to routeChart
                        vent.trigger('airport:hover', pickedCity.iata);

                        routesHighlight([pickedCity.iata]);
                    }else{
                        $('.custom-tooltip').css({
                            'left':'-9999px'
                        });
                    }
                    //update mouseRange
                    onMouseMove(d3.mouse(this));
                })
                .on('mouseout',function(){
                    //emit event to route chart
                   vent.trigger('airport:out');

                    routeOut();
                });

            canvas.append('path')
                .datum({type: 'Sphere'})
                .attr('class', 'outline');

            canvas.append('path')
                .datum(graticule)
                .attr('class', 'graticule');

            var mouseRange = canvas.append('circle')
                .attr('class', 'range mouse-range')
                .attr('cx', width/2)
                .attr('cy', height/2);

            var mousePointer = canvas.append('g')
                .attr('class', 'mouse-pointer')
                .style('display','none')
                .on('mouseover',function(){
                    d3.event.stopPropagation();
                });
            mousePointer.append('svg:image')
                .attr('width',15)
                .attr('height',16)
                .attr('x',-7.5)
                .attr('y',-21)
                .attr('xlink:href','./assets/img/plane-icon.png');
            mousePointer.append('text')
                .attr('text-anchor','end')
                .attr('x',-10)
                .attr('y',-5);

            queue()
                .defer(d3.json, './data/world-50m.json')
                .defer(d3.csv, './data/airports.csv', function(d){
                    return{
                        name: d.name,
                        city: d.city,
                        country: d.country,
                        iata: d.iata,
                        lng: d.lng,
                        lat: d.lat,
                        loc: [+d.lng, +d.lat]
                    }
                })
                .defer(d3.csv, './data/routes.csv', function(d){
                    return{
                        airline: [d.airline],
                        origin: d.origin,
                        dest: d.dest,
                        equipment: d.equipment.split(" ")
                    }
                })
                .await(dataLoaded);


            function dataLoaded(err, world, _airports, _routes){
                //$('.container .canvas').removeClass('loading');

                routes = _routes;
                airports = _airports;

                canvas.insert('path', '.graticule')
                    .datum(topojson.feature(world, world.objects.land))
                    .attr('class', 'land');

                canvas.insert('path', '.graticule')
                    .datum(topojson.mesh(world, world.objects.countries, function (a, b) {
                        return a !== b;
                    }))
                    .attr('class', 'countries');

                canvas.append('g')
                    .attr('class','airports');

                redraw();

                //autocomplete and city picking
                $('.control .input-group input').autocomplete({
                    source: _.map(airports,function(_a){
                        return {
                            'value': _a.iata,
                            'label': _a.name + ',' + _a.city + ' (' + _a.iata + ')'
                        };
                    }),
                    select: function(e,ui){
                        changeCity(ui.item.value);
                    }
                });
                $(document).on('change','.control .input-group input',function(e){
                    changeCity($(this).val());
                });

                pickCity("BOS");
            }

            function redraw() {
                canvas.selectAll('.outline,.graticule,.land,.countries,.routes')
                    .attr('d', path);

                canvas.selectAll('.airport')
                    .attr('cx', function(d){ return (projection([d.lng, d.lat]))[0]; })
                    .attr('cy', function(d){ return (projection([d.lng, d.lat]))[1]; });
            }

            function changeCity(_iata){
                //city --> iata code
                console.log("changing to: " + _iata);
                center = _iata;
                var city = _.findWhere(airports,{'iata':_iata});

                //validate city
                if(!city){
                    alert("city doesn't exist");
                    return;
                }

                //code for actually drawing the routes and nodes

                canvas.selectAll('.routes').remove();
                pickCity(city.iata);

                canvas.transition()
                    .duration(1000)
                    .delay(500)
                    .each('start', function(){
                        mouseRange.style('display','none');
                    })
                    .tween('path', pathTween(projection.rotate(), [ -city.lng, -city.lat,0 ]))
                    .each('end', function(){
                        mouseRange.style('display',null);
                    });
            }

            function pickCity(center){
                //finds connected cities and routes, draw them accordingly
                //DOES NOT center globe; DOES NOT clear connected airports or possible routes
                var cities = [], //array of iata codes for connected airports
                    citiesData = [], //array of full data for connected airports
                    geo = {
                        type:'FeatureCollection',
                        features:[]
                    };
                route_w_city = [];

                route_w_city = routes.filter(function(r){
                    if(r.origin === center){
                        cities.push(r.dest);
                        return true;
                    }else if(r.dest === center){
                        cities.push(r.origin);
                        return true;
                    }else{
                        return false;
                    }
                });

                cities.push(center);
                cities = _.uniq(cities);
                cities.forEach(function(c){
                    var cityData = _.findWhere(airports,{"iata":c});
                    if(cityData) citiesData.push( cityData );
                });

                //turn route_w_city to GeoJSON feature collection
                route_w_city.forEach(function(r){
                    var origin = _.findWhere(citiesData, {"iata" : r.origin}),
                        dest = _.findWhere(citiesData, {"iata" : r.dest});

                    if(origin && dest){
                        geo.features.push({
                            "type":"Feature",
                            "geometry":{
                                "type":"LineString",
                                "coordinates":[[origin.lng, origin.lat],[dest.lng, dest.lat]]
                            },
                            "properties": r
                        });
                    };
                });

                //enter, update, exit for airports
                var airportGroup = canvas.select('.airports');
                var airportCircle = airportGroup.selectAll('.airport')
                    .data(citiesData, function(d){ return d.iata; });

                airportCircle.enter()
                    .append('circle')
                    .attr('r',0);

                airportCircle
                    .attr('class','airport connected')
                    .attr('cx', function(d){ return (projection([d.lng, d.lat]))[0]; })
                    .attr('cy', function(d){ return (projection([d.lng, d.lat]))[1]; })
                    .attr('r',2.5)
                    .filter(function(d){
                        return d.iata === center;
                    })
                    .attr('class','airport center')
                    .attr('r',6)
                    .style('fill',null);

                airportCircle.exit().remove();

                //draw route path for the first time
                var route_paths = canvas.insert('path','.airports')
                    .attr('class','routes')
                    .datum(geo)
                    .attr('d',path);
                var totalLength = route_paths.node().getTotalLength();
                route_paths
                    .attr('stroke-dasharray', totalLength + " " + totalLength)
                    .attr('stroke-dashoffset', totalLength)
                    .transition()
                    .duration(1500)
                    .attr('stroke-dashoffset',0);

                //Announce routes to other modules
                vent.trigger('city:picked', route_w_city, airports, center);

                //TODO
                routeOut();
            };

            function onMouseMove(mouse){
                var dx = mouse[0]-width/ 2,
                    dy = mouse[1]-height/ 2,
                    r = Math.sqrt(dx*dx + dy*dy),
                    range = r/120*6371;
                angle = Math.atan2(dy,dx);

                //Announce mouse range change to other modules
                vent.trigger('mouseRange:change',range);
                updateRange(range);
            }

            function updateRange(range){
                var r = range/6371*120;

                mouseRange
                    .attr('r',r);
                mousePointer
                    .style('display',null)
                    .attr('transform','translate('+width/2+','+height/2+')rotate('+ angle/Math.PI*180 + ')translate(0'+ r +')');
                mousePointer.select('text')
                    .attr('text-anchor',function(){
                        return range < 12000? 'start':'end';
                    })
                    .attr('x',function(){
                        return range < 12000? 10:-10;
                    })
                    .text(function(){
                        return format(range)+'km';
                    });
            }

            //factory function for tweening between two projection rotations
            function pathTween(rotation0, rotation1) {
                var t = 0;
                var i = d3.interpolate(rotation0, rotation1);

                return function () {
                    return function (u) {
                        t = u;
                        projection.rotate([i(u)[0], i(u)[1]]);
                        path.projection(projection);

                        redraw();
                    };
                };
            }

            function routesHighlight(destIatas, typeFlag){

                var highlightColor;
                if(typeFlag === "aircraft"){
                    highlightColor = "#EE2962";
                }else{
                    highlightColor = '#03AFEB';
                }

                //destIatas --> array of airport IATA codes to highlight
                var origin = _.findWhere(airports,{"iata":center}),
                    destsXY = [];

                destIatas.forEach(function(_d){
                    var _dAirport = _.findWhere(airports,{"iata":_d});
                   destsXY.push( projection(_dAirport.loc) );
                });
                var originXY = projection(origin.loc);

                canvas.selectAll('.hover')
                    .attr('class','airport connected')
                    .transition()
                    .style('fill',null)
                    .attr('r',2.5);

                var hoverAirport = canvas.selectAll('.connected')
                    .filter(function(d){
                        return _.contains(destIatas, d.iata);
                    })
                    .attr('class','airport connected hover')
                    .transition()
                    .duration(50)
                    .style('fill', highlightColor)
                    .attr('r',6);

                var hoverRoute = canvas.selectAll('.hover-route')
                    .data(destsXY);

                hoverRoute.enter().insert('line','.airports')
                    .attr('class','hover-route')
                    .style('stroke', highlightColor);

                hoverRoute
                    .attr('x1',originXY[0])
                    .attr('y1',originXY[1])
                    .attr('x2',function(d){ return d[0];})
                    .attr('y2',function(d){ return d[1];});
            };

            function routeOut(){
                canvas.selectAll('.hover')
                    .attr('class','airport connected')
                    .transition()
                    .style('fill',null)
                    .attr('r',2.5);

                canvas.selectAll('.hover-route')
                    .remove();
            }

            function onAircraftHover(model){
                mouseRange
                    .style('stroke','#EE2962')
                    .style('fill','#EE2962');
                mousePointer
                    .select('text')
                    .style('fill','#EE2962');

                //code to highlight routes
                var dests = [];
                route_w_city.forEach(function(r){
                    if(_.contains(r.equipment, model)){
                        dests.push(r.dest);
                    }
                });

                routesHighlight(dests, "aircraft");
            }

            function onAircraftOut(){
                mouseRange
                    .style('stroke',null)
                    .style('fill',null);
                mousePointer
                    .select('text')
                    .style('fill',null);

                routeOut();
            }

            vent.on('route:hover', routesHighlight);
            vent.on('route:out', routeOut);
            vent.on('planeChart:mouseRange:change',updateRange);
            vent.on('planeChart:aircraft:hover', onAircraftHover);
            vent.on('planeChart:aircraft:out', onAircraftOut);
        }
    });

    var globeView = new GlobeView();

    return globeView;
});