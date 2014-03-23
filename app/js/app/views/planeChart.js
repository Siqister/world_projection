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

    var distScale = d3.scale.linear().domain([0,16000]);

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
            rangeLine.append('line')
                .attr('x1',0)
                .attr('y1',0)
                .attr('x2',width)
                .attr('y2',0)
                .attr('class','mouse-range');

            svg.on('mousemove',function(){
                console.log('mousemove');
            })

            vent.off('mouseRange:change')
                .on('mouseRange:change',updateRange);

            function updateRange(range){
                rangeLine
                    .transition()
                    .attr('transform','translate(0,'+distScale(range)+')');
            }
        }
    });

    return PlaneChartView;
});