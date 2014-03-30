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

    var tooltipTemplate = _.template('<%= company %> <%= fullName %><br /><span>Introduced in <%= year %></span><br/><span><%= desc %></span>');

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
            //Mouse interaction target
            svg.append('rect')
                .attr('class','mouse-target')
                .attr('x',0)
                .attr('y',0)
                .attr('width',width)
                .attr('height',height)
                .style('fill-opacity',0);


            //Range ticks
            svg.append('text')
                .text('Range')
                .attr('transform','rotate(-90)translate(-50,10)');
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


            //draw ticks for passenger capcity
            var paxLegend = svg.append('g')
                .attr('class','legend pax')
                .attr('transform','translate(0,'+ height +')');

            paxLegend.append('text')
                .attr('text-anchor','middle')
                .attr('x',width/2)
                .attr('y', 35)
                .text('Pax Capacity');

            var paxTicks = paxLegend
                .selectAll('.pax-tick')
                .data([100,200,300,400,500])
                .enter()
                .append('g')
                .attr('class','pax-tick')
                .attr('transform',function(d){
                    return 'translate('+ paxScale(+d) +')';
                });
            paxTicks.append('text')
                .text(function(d){
                    return d;
                })
                .attr('text-anchor','middle')
                .attr('dy',18);
            paxTicks.append('line')
                .attr('x1',0)
                .attr('x2',0)
                .attr('y1',0)
                .attr('y2',5);


            //Moving mouse target
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
                    year: +d.year,//new Date(+d.year,+d.month)
                    desc: d.desc? d.desc:""
                };
            },dataLoaded);

            function dataLoaded(err,_aircrafts){
                aircrafts = _aircrafts;

                drawChart();

                //TODO: creates race condition with globeView
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

                        //tooltip
                        $('.custom-tooltip').html(tooltipTemplate(d));
                        $('.custom-tooltip').addClass('aircraft');
                        var tooltipWidth = $('.custom-tooltip').width();
                        $('.custom-tooltip').css({
                            'left':d3.event.x - tooltipWidth - 20 + 'px',
                            'top':d3.event.y + 10 + 'px'
                        });


                    })
                    .on('mouseleave',function(d){
                        svg.on('mousemove',onMouseMove);
                        rangeLine.select('line')
                            .style('stroke',null);
                        rangeLine.select('rect')
                            .style('fill',null);

                        vent.trigger('planeChart:aircraft:out');

                        $('.custom-tooltip').removeClass('aircraft');
                        $('.custom-tooltip').css({
                            'left':'-9999px'
                        });
                    });
                aircraftNodeEnter.append('circle')
                    .attr('r',function(d){
                        return paxSizeScale(d.paxTypical)+2;
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
                       return 'translate('+ paxScale(d.paxTypical) +','+ distScale(d.range- d.speed*3) + ')';
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
                var aircraftNodeOut = svg.selectAll('.model')
                    .attr('class','model');
                aircraftNodeOut
                    .select('image')
                    .attr('xlink:href','./assets/img/plane-icon-white.png');
                svg.selectAll('.meta')
                    .remove();

                var aircraftNodeUsed = svg.selectAll('.model')
                    .filter(function(d){
                        return _.contains(aircraftsUsed, d.shortName);
                    })
                    .attr('class','model used');
                aircraftNodeUsed
                    .select('image')
                    .attr('xlink:href','./assets/img/plane-icon.png');
                aircraftNodeUsed
                    .append('text')
                    .text(function(d){
                        return d.shortName;
                    })
                    .attr('text-anchor','middle')
                    .attr('class','meta')
                    .attr('y',-13);
            }

            function onMouseMove(){
                var range = distScale.invert(d3.mouse(this)[1]);
                updateRange(range);
                vent.trigger('planeChart:mouseRange:change',range);
            }

            function updateRange(range){
                rangeLine
                    .attr('transform','translate(0,'+distScale(range)+')')
                    .select('rect')
                    .attr('height',distScale(18000-range));
            }

            vent.on('route:hover',function(dest, equipment){
                var aircraftOnRoute = svg.selectAll('.used')
                    .filter(function(d){
                        return _.contains(equipment, d.shortName);
                    })
                    .attr('class', 'model used on-route');
                aircraftOnRoute
                    .select('circle')
                    .style('fill','#03afeb')
                    .style('fill-opacity',1);
                aircraftOnRoute
                    .select('text')
                    .style('fill','#03afeb');
            });
            vent.on('route:out',function(){
                var aircraftOnRoute =  svg.selectAll('.on-route')
                    .attr('class', 'model used');
                aircraftOnRoute
                    .select('circle')
                    .style('fill',null)
                    .style('fill-opacity',null);
                aircraftOnRoute
                    .select('text')
                    .style('fill',null);
            });
        }
    });

    return PlaneChartView;
});