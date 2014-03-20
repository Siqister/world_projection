//bootstrap
var currentCity = "BOS";
var routes, airports;

var margin = {t: 50, r: 50, b: 50, l: 50},
    width = $('.canvas').innerWidth() - margin.l - margin.r,
    height = $('.canvas').innerHeight() - margin.t - margin.b;

var projection = d3.geo.azimuthalEquidistant()
    .scale(120)
    .translate([width / 2, height / 2])
    .rotate([71, -42.358431, 0])
    .clipAngle(180 - 1e-3)
    .precision(.1);

var path = d3.geo.path()
    .projection(projection);

var graticule = d3.geo.graticule();

var svg = d3.select('.canvas').append('svg')
    .attr('width', width + margin.l + margin.r)
    .attr('height', height + margin.t + margin.b);

var canvas = svg.append('g')
    .attr('class', 'canvas')
    .attr('transform', 'translate(' + margin.l + ',' + margin.t + ')')
    .on('click', function () {
        var location = projection.invert(d3.mouse(this));
        d3.event.stopPropagation();

        d3.select(this).transition()
            .duration(2000)
            .tween('path', pathTween(projection.rotate(), [ -location[0], -location[1],0 ]));
    });

canvas.append('path')
    .datum({type: 'Sphere'})
    .attr('class', 'outline');

canvas.append('path')
    .datum(graticule)
    .attr('class', 'graticule');

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

    canvas.insert('g', '.graticule')
        .attr('class','airports')
        .selectAll('.airport')
        .data(airports)
        .enter()
      .append('circle')
        .attr('class','airport')
        .attr('r',1);

    redraw();

    pickCity(currentCity);
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
        .attr('r',2.5)
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

    //draw route path
    canvas.selectAll('.routes').transition().remove();
    canvas.insert('path','.airports')
        .attr('class','routes')
        .datum(geo)
        .attr('d',path);
};

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