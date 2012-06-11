(function() {
    var Map = function(canvas_el) {
        this.canvas = canvas_el;
        this.ctx = canvas_el.getContext('2d');
        this.render();
    };
    Map.prototype = {
        canvas: undefined,
        ctx: undefined,
        
        render: function() {
            this.load_tile_img(0, 0, 0, function cb(img) {
                this.ctx.drawImage(img, 0, 0);
            });
        },
        
        load_tile_img: function(zoomlevel, column, row, callback) {
            var that = this;
            var url = this.get_tile_url(zoomlevel, column, row);
            var img = new Image();
            img.src = url;
            img.onload = function() {
                callback.call(that, img);
            }
        },
                
        get_tile_url: function(zoomlevel, column, row) {
            var id = [zoomlevel, column, row].join("/");
            var url = "http://" + ['a', 'b', 'c'][Math.floor(Math.random() * 3)] + ".maptile.maps.svc.ovi.com/maptiler/v2/maptile/newest/normal.day/" + id + "/256/png8";
            return url;
        }
    }
        
    var map = new Map(document.getElementById('mymap'));
})();
