//bootstrap
var routes, airports;

var margin = {t: 50, r: 50, b: 50, l: 50},
    width = $('.canvas').innerWidth() - margin.l - margin.r,
    height = $('.canvas').innerHeight() - margin.t - margin.b;

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


//Start drawing

var svg = d3.select('.canvas').append('svg')
    .attr('width', width + margin.l + margin.r)
    .attr('height', height + margin.t + margin.b);

var canvas = svg.append('g')
    .attr('class', 'canvas')
    .attr('transform', 'translate(' + margin.l + ',' + margin.t + ')')
    .on('click', function () {
        //location --> location of mouse click
        //if mouse click is on a connected airport, center map on the new airport
        var target = d3.select(d3.event.toElement),
            location = projection.invert(d3.mouse(this)),
            pickedCity = target.classed('connected')? target.datum():null;
        d3.event.stopPropagation();

        d3.select(this).transition()
            .duration(1000)
            .each('start', function(){
               mouseRange.style('display','none');
               if(pickedCity){
                   canvas.selectAll('.routes').remove();
                   canvas.selectAll('.connected,.center')
                       .attr('r',1)
                       .attr('class','airport');
                   target
                       .attr('class','airport center')
                       .attr('r',6);
               }
            })
            .tween('path', pathTween(projection.rotate(), [ -location[0], -location[1],0 ]))
            .each('end', function(){
               mouseRange.style('display',null);
               if(pickedCity) pickCity( pickedCity.iata );
            });
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
        }else{
            $('.custom-tooltip').css({
                'left':'-9999px'
            });
        }

        //update mouseRange
        updateMouseRange(d3.mouse(this));
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

queue()
    .defer(d3.json, './data/world-50m.json')
    .defer(d3.csv, './data/airports.csv')
    .defer(d3.csv, './data/routes.csv')
    .await(dataLoaded);


function dataLoaded(err, world, _airports, _routes){
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
        .attr('class','airports')
        .selectAll('.airport')
        .data(airports)
        .enter()
      .append('circle')
        .attr('class','airport')
        .attr('r',1);

    redraw();

    //autocomplete and city picking
    $('.control .input-group input').autocomplete({
       source: _.map(airports,function(_a){
           return {
             'value': _a.iata,
             'label': _a.name + ',' + _a.city + ' (' + _a.iata + ')'
           };
       })
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

function pickCity(city){
    var cities = [],
        route_w_city = [],
        geo = {
            type:'FeatureCollection',
            features:[]
        };

    route_w_city = routes.filter(function(r){
        if(r.origin === city){
            cities.push(r.dest);
            return true;
        }else if(r.dest === city){
            cities.push(r.origin);
            return true;
        }else{
            return false;
        }
    });

    canvas.selectAll('.airport')
        .filter(function(d){
            return _.contains(cities, d.iata);
        })
        .attr('r',3.5)
        .attr('class','airport connected');

    //turn route_w_city to GeoJSON feature collection
    route_w_city.forEach(function(r){
       var origin = _.findWhere(airports, {"iata" : r.origin}),
           dest = _.findWhere(airports, {"iata" : r.dest});

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
        .duration(5000)
        .attr('stroke-dashoffset',0);
};

function updateMouseRange(mouse){
    var dx = mouse[0]-width/ 2,
        dy = mouse[1]-height/ 2,
        a = Math.atan2(dy,dx),
        r = Math.sqrt(dx*dx + dy*dy);

    mouseRange
        .attr('r',r);
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