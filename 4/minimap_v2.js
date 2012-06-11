(function() {
    "use strict";
    //Zoomlevels on the server
    var MAX_ZOOMLEVEL = 20;

    //Size of a single tile
    var BITS_PER_TILE = 8; // 256 -> 8 bits...
    //This will be our resolution
    var NR_OF_BITS = MAX_ZOOMLEVEL + BITS_PER_TILE; // < 2^31 ? 
    var NR_OF_PIXELS_ON_LAST_ZOOMLEVEL = 1 << NR_OF_BITS; // 2^28
    //-------------
    /** @class Coordinate
     *  @abstract
     */
    var Coordinate = function() {};

    Coordinate.prototype = {
        precision: NR_OF_BITS,
        x: undefined,
        y: undefined,
        offset: function(coordinate) {
            //TODO: it's actually tricky with multiple precisions, homework... ;-)
            //Hint: What does 3 << -1 give in JS?
            this.x = this.x + coordinate.x;
            this.y = this.y + coordinate.y;
        }
    };

    //helper function
    var beget = function(o) {
        var F = function() {};
        F.prototype = o;
        return new F();
    };

    /** @class GeoCoordinate
     * @implements Coordinate
     * A GeoCoordinate is a Coordinate in WGS-84 space, stored in max-resolution mercator.
     */
    var GeoCoordinate = function(lat, lng) {
        this.lat = lat;
        this.lng = lng;
        this.doTheMercatorMagic(lat, lng);
    };
    GeoCoordinate.prototype = beget(Coordinate.prototype);
    GeoCoordinate.prototype.precision = NR_OF_BITS;
    GeoCoordinate.prototype.doTheMercatorMagic = function(lat, lng) {
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
    };

    Object.defineProperty(GeoCoordinate.prototype, "column", {
        get: function() {
            return this.x;
        },
        set: function(v) {
            this.x = v;
        },
    });
    Object.defineProperty(GeoCoordinate.prototype, "row", {
        get: function() {
            return this.y;
        },
        set: function(v) {
            this.y = v;
        },
    });

    /** @class TileCoordinate
     * @implements Coordinate
     * A TileCoordinate is a coordinate of a tile
     */

    var TileCoordinate = function(zoomlevel, coordinate_or_column, row_if_column) {
        this.zoomlevel = zoomlevel;
        if (coordinate_or_column instanceof Coordinate) {
            this.x = coordinate_or_column.x;
            this.y = coordinate_or_column.y;
        } else {
            this.column = coordinate_or_column;
            this.row = row_if_column;
        }
    };
    TileCoordinate.prototype = beget(Coordinate.prototype);
    TileCoordinate.prototype.zoomlevel = Coordinate.prototype.precision;

    Object.defineProperty(TileCoordinate.prototype, "id", {
        get: function() {
            return [this.zoomlevel, this.column, this.row].join("/");
        },
        set: function(v) {
            var data = v.split('/');
            this.zoomlevel = data[0];
            this.column = data[1];
            this.row = data[2];
        },
    });


    Object.defineProperty(TileCoordinate.prototype, "column", {
        get: function() {
            return this.x >> (this.precision - this.zoomlevel);
        },
        set: function(v) {
            this.x = v << (this.precision - this.zoomlevel);
        },
    });
    Object.defineProperty(TileCoordinate.prototype, "row", {
        get: function() {
            return this.y >> (this.precision - this.zoomlevel);
        },
        set: function(v) {
            this.y = v << (this.precision - this.zoomlevel);
        },
    });

    /** @class ScreenCoordinate
     * @implements Coordinate
     * A ScreenCoordinate is a coordinate on the screen of a given map.
     * It's very similar to TileCoordinate, except it has an offset, 
     * and it's implemented separately only because of differences in variable names.
     */

    var ScreenCoordinate = function(map, coordinate_or_column, row_if_column) {
        this.map = map;
        if (coordinate_or_column instanceof Coordinate) {
            this.x = coordinate_or_column.x;
            this.y = coordinate_or_column.y;
        } else {
            this.column = coordinate_or_column;
            this.row = row_if_column;
        }
    };
    ScreenCoordinate.prototype = beget(Coordinate.prototype);
    ScreenCoordinate.prototype.zoomlevel = Coordinate.prototype.precision;


    Object.defineProperty(ScreenCoordinate.prototype, "column", {
        get: function() {
            return (this.x - this.map.topleft.x) >> (this.precision - this.map.zoomlevel);
        },
        set: function(v) {
            throw new Error('trying to set a readonly property of ScreenCoordinate');
        },
    });

    Object.defineProperty(ScreenCoordinate.prototype, "row", {
        get: function() {
            return (this.y - this.map.topleft.x) >> (this.precision - this.map.zoomlevel);
        },
        set: function(v) {
            throw new Error('trying to set a readonly property of ScreenCoordinate');
        },
    });


    //TODO: testsuite - we do have one, but it would be boring to show one here.
    /** @class Map
      * A map - or, in this case, a mapview - is an actual widget on the screen 
      */
    var Map = function(canvas_el, options) {
        this.canvas = canvas_el;
        if (options) {
            jQuery.extend(this, options); //shorter than for p in..
        }
        this.ctx = canvas_el.getContext('2d');
        this.render();
    };
    Map.prototype = {
        canvas: undefined,
        ctx: undefined,
        startposition: {
            lat: 47.49658,
            lon: 19.057811
        },
        zoomlevel: 15,
        render: function() {
            var tile_x, tile_y, position;
            position = new GeoCoordinate(this.startposition.lat, this.startposition.lon);
            var tile_coordinate = new TileCoordinate(this.zoomlevel, position);
            this.load_tile_img(tile_coordinate, function cb(img) {
                this.ctx.drawImage(img, 0, 0);
            });
        },

        load_tile_img: function(tilecoordinate, callback) {
            var that = this;
            var url = this.get_tile_url(tilecoordinate);
            var img = new Image();
            img.src = url;
            img.onload = function() {
                callback.call(that, img);
            };
        },

        get_tile_url: function(tilecoordinate) {
            var id = tilecoordinate.id;
            var url = "http://" + ['a', 'b', 'c'][Math.floor(Math.random() * 3)] + ".maptile.maps.svc.ovi.com/maptiler/v2/maptile/newest/normal.day/" + id + "/256/png8";
            return url;
        }
    };

    var map = new Map(document.getElementById('mymap'), {
        zoomlevel: 16
    });
})();
