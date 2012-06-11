(function() {
    //Zoomlevels on the server
    var MAX_ZOOMLEVEL = 20;

    //Size of a single tile
    var BITS_PER_TILE = 8; // 256 -> 8 bits...
    //This will be our resolution
    var NR_OF_BITS = MAX_ZOOMLEVEL + BITS_PER_TILE; // < 2^31 ? 
    var NR_OF_PIXELS_ON_LAST_ZOOMLEVEL = 1 << NR_OF_BITS; // 2^28
    
    var Coordinate = function(lat, lng) {
        this.doTheMercatorMagic(lat, lng);
    };
    Coordinate.prototype = {
        x: undefined,
        y: undefined,
        doTheMercatorMagic: function(lat, lng) {
            //Flatten the Earth! Yay!
            var m = Math,
                min = m.min,
                max = m.max,
                tan = m.tan,
                PI = m.PI,
                exp = m.exp,
                log = m.log,
                round = m.round;

            this.x = round((lng / 360 + 0.5) * NR_OF_PIXELS_ON_LAST_ZOOMLEVEL);
            this.y = round(min(1, max(0, 0.5 - (log(tan(PI / 4 + PI / 2 * lat / 180)) / PI) / 2)) * NR_OF_PIXELS_ON_LAST_ZOOMLEVEL);
        }
    };
    //TODO: testsuite - we do have one, but it would be boring to show one here.
    
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
