define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',

    'vent',

    'd3',

    'jquery-ui'
],function(
    $,
    _,
    Backbone,
    Marionette,

    vent,

    d3
    ){
    var margin = {t: 50, r: 20, b: 50, l: 10},
        width,
        height,
        svg;

    var aircrafts,
        aircraftsUsed;

    var distScale = d3.scale.linear().domain([0,18000]),
        paxScale = d3.scale.linear().domain([50,550]),
        paxSizeScale = d3.scale.threshold().domain([100,180,280]).range([3,5,7,9]),
        ageColorScale = d3.scale.threshold().domain([1960,1970,1980,1990,2000]).range(['#4D7A9D','#B6D5ED','#C2E5F9','#FCD4E3','#F48BA0','#EE2971']);

    var PlaneChartView = Marionette.ItemView.extend({
        className:"plane-chart-inner",
        initialize: function(){

        },
        render: function(){

        },
        onShow: function(){
            width = this.$el.innerWidth() - margin.l - margin.r;
            height = this.$el.innerHeight() - margin.t - margin.b;
            distScale.range([height,0]);
            paxScale.range([0,width]);

            svg = d3.select(this.el).append('svg')
                .attr('width',width+margin.l+margin.r)
                .attr('height',height+margin.t+margin.b)
                .append('g')
                .attr('transform','translate('+margin.l+','+margin.t+')');

            svg.append('rect')
                .attr('class','mouse-target')
                .attr('x',0)
                .attr('y',0)
                .attr('width',width)
                .attr('height',height)
                .style('fill-opacity',0);

            var rangeTicks = svg.selectAll('.range-tick')
                .data([0,2500,5000,7500,10000,12500,15000])
                .enter()
                .append('g')
                .attr('class',function(d){
                    if(d%5000 === 0){
                        return 'range-tick major';
                    }else{
                        return 'range-tick minor';
                    }
                })
                .attr('transform', function(d){
                    return 'translate(0,'+distScale(d)+')';
                })
            rangeTicks.append('line')
                .attr('x1',0)
                .attr('y1',0)
                .attr('x2',width)
                .attr('y2',0);
            rangeTicks.append('text')
                .attr('x',0)
                .attr('y',-3)
                .text(function(d){ return d + 'km'; });


            var rangeLine = svg.append('g')
                .attr('class','range-line');
            rangeLine.append('rect')
                .attr('x',0)
                .attr('y',0)
                .attr('width',width)
                .attr('height',height);
            rangeLine.append('line')
                .attr('x1',0)
                .attr('y1',0)
                .attr('x2',width)
                .attr('y2',0)
                .attr('class','mouse-range');


            svg.on('mousemove', onMouseMove);

            vent.off('mouseRange:change')
                .on('mouseRange:change',updateRange);


            //load aircraft data
            d3.csv('./data/aircrafts.csv',function(d){
                return {
                    company:d.company,
                    model: d.model,
                    fullName: d.model+'-'+ d.variant,
                    shortName: d.model_short,
                    range: +d.range,
                    pax: [+d.pax_min, +d.pax_max],
                    paxTypical: ((+d.pax_min)+(+d.pax_max))/2,
                    speed: +d.speed,
                    year: +d.year//new Date(+d.year,+d.month)
                };
            },dataLoaded);

            function dataLoaded(err,_aircrafts){
                aircrafts = _aircrafts;

                drawChart();

                vent.on("city:picked",onCityPicked);
            }

            function drawChart(){
                var aircraftNode = svg.selectAll('.model')
                    .data(aircrafts);

                var aircraftNodeEnter = aircraftNode
                    .enter()
                    .append('g')
                    .attr('class','model')
                    .on('mouseenter',function(d){
                        svg.on('mousemove',null);

                        //range snapping
                        vent.trigger("planeChart:mouseRange:change", d.range);
                        updateRange(d.range);
                        rangeLine.select('line')
                            .style('stroke','#EE2962');
                        rangeLine.select('rect')
                            .style('fill','#EE2962');


                        //alert aircraft hover
                        vent.trigger("planeChart:aircraft:hover", d.shortName);
                    })
                    .on('mouseleave',function(d){
                        svg.on('mousemove',onMouseMove);
                        rangeLine.select('line')
                            .style('stroke',null);
                        rangeLine.select('rect')
                            .style('fill',null);


                        vent.trigger('planeChart:aircraft:out');
                    });
                aircraftNodeEnter.append('circle')
                    .attr('r',function(d){
                        return paxSizeScale(d.paxTypical)+3;
                    });
                aircraftNodeEnter.append('image')
                    .attr('xlink:href','./assets/img/plane-icon-white.png')
                    .attr('width',function(d){
                        return paxSizeScale(d.paxTypical)*2;
                    })
                    .attr('height',function(d){
                        return paxSizeScale(d.paxTypical)*2;
                    })
                    .attr('x',function(d){
                        return -paxSizeScale(d.paxTypical);
                    })
                    .attr('y',function(d){
                        return -paxSizeScale(d.paxTypical);
                    });

                aircraftNode
                    .attr('transform',function(d){
                       return 'translate('+ paxScale(d.paxTypical) +','+ distScale(d.range- d.speed) + ')';
                    })
                    .transition()
                    .duration(2000)
                    .attr('transform',function(d){
                        return 'translate('+ paxScale(d.paxTypical) +','+ distScale(d.range) + ')';
                    });
            }

            function onCityPicked(routes,airports,city){
                aircraftsUsed=[];
                routes.forEach(function(r){
                    aircraftsUsed = aircraftsUsed.concat(r.equipment);
                });
                aircraftsUsed = _.uniq(aircraftsUsed);

                redraw();
            }

            function redraw(){
                svg.selectAll('.model')
                    .select('circle')
                    .transition()
                    .style('fill',null)
                    .style('fill-opacity',null);
                svg.selectAll('.model')
                    .filter(function(d){
                        return _.contains(aircraftsUsed, d.shortName);
                    })
                    .select('circle')
                    .transition()
                    .style('fill',function(d){
                        return ageColorScale(d.year);
                    })
                    .style('fill-opacity',1);
            }

            function onMouseMove(){
                var range = distScale.invert(d3.mouse(this)[1]);
                updateRange(range);
                vent.trigger('planeChart:mouseRange:change',range);
            }

            function updateRange(range){
                console.log(distScale(range));
                rangeLine
                    .attr('transform','translate(0,'+distScale(range)+')')
                    .select('rect')
                    .attr('height',distScale(18000-range));
            }
        }
    });

    return PlaneChartView;
});