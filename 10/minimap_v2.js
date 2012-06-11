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
            var coord = new Coordinate();
            coord.x = this.x + coordinate.x;
            coord.y = this.y + coordinate.y;
            return coord;
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
            return (this.x - this.map.topleft.x) >> (this.precision - this.map.zoomlevel - BITS_PER_TILE);
        },
        set: function(v) {
            this.x = v << (this.precision - this.map.zoomlevel - BITS_PER_TILE) + this.map.topleft.x;
        },
    });

    Object.defineProperty(ScreenCoordinate.prototype, "row", {
        get: function() {
            return (this.y - this.map.topleft.y) >> (this.precision - this.map.zoomlevel - BITS_PER_TILE);
        },
        set: function(v) {
            this.y = v << (this.precision - this.map.zoomlevel - BITS_PER_TILE) + this.map.topleft.y;
        },
    });

    /**@class ScreenOffsetCoordinate 
     @extends TileCoordinate
     This is a helper class to help calculate with screen offsets
     */
    var ScreenOffsetCoordinate = function(map, offset_x, offset_y) {
        this.map = map;
        this.column = offset_x;
        this.row = offset_y;
    }
    ScreenOffsetCoordinate.prototype = beget(TileCoordinate.prototype);
    Object.defineProperty(ScreenOffsetCoordinate.prototype, "zoomlevel", {
        get: function() {
            return (this.map.zoomlevel + BITS_PER_TILE);
        },
        set: function() {
            throw new Exception('cannot set zoomlevel of a map-dependent coordinate like ScreenOffsetCoordinate');
        }
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
        if (this.startposition) {
            this.topleft = new GeoCoordinate(this.startposition.lat, this.startposition.lon);
        }
        this.ctx = canvas_el.getContext('2d');
        this.render();
    };
    Map.prototype = {
        canvas: undefined,
        moving: false,
        get width() {
            return this.canvas.width;
        },
        get height() {
            return this.canvas.height;
        },
        ctx: undefined,
        startposition: {
            lat: 47.49658,
            lon: 19.057811
        },
        rendered: false,
        _zoomlevel: 15,
        get zoomlevel() {
            return this._zoomlevel;
        },
        set zoomlevel(v) {
            this._zoomlevel = v;
            if (this.rendered) {
                this.render();
            }
        },
        _topleft: new GeoCoordinate(47.49658, 19.057811),
        get topleft() {
            return this._topleft;
        },
        set topleft(v) {
            this._topleft = v;
            if (this.rendered) {
                this.render();
            }
        },

        render: function() {
            window.stop();
            var tile_x, tile_y, position;

            var topleft_tile_coordinate = new TileCoordinate(this.zoomlevel, this.topleft);
            var bottomright_tile_coordinate = new TileCoordinate(this.zoomlevel, this.topleft.offset(new ScreenOffsetCoordinate(this, this.width, this.height)));

            var x, y;
            for (x = topleft_tile_coordinate.column; x <= bottomright_tile_coordinate.column + 1; ++x) {
                for (y = topleft_tile_coordinate.row; y <= bottomright_tile_coordinate.row + 1; ++y) {
                    this.load_tile_img(new TileCoordinate(this.zoomlevel, x, y), function cb(img, tilecoordinate) {
                        var coordinate = new ScreenCoordinate(this, tilecoordinate);
                        this.ctx.drawImage(img, coordinate.column, coordinate.row);
                    });
                }
            }
            this.rendered = true;
        },
        tileCache: {},
        load_tile_img: function(tilecoordinate, callback) {
            var that = this;
            var url = this.get_tile_url(tilecoordinate);
            var img = new Image();
            if (that.tileCache[tilecoordinate.id]){
                callback.call(that, that.tileCache[tilecoordinate.id], tilecoordinate);
            } else if (!this.is_moving()){
                img.src = url;
                img.onload = function() {
                    that.tileCache[tilecoordinate.id] = img;
                    callback.call(that, img, tilecoordinate);
                };
            }
        },

        get_tile_url: function(tilecoordinate) {
            var id = tilecoordinate.id;
            var url = "http://" + ['a', 'b', 'c'][Math.floor(Math.random() * 3)] + ".maptile.maps.svc.ovi.com/maptiler/v2/maptile/newest/normal.day/" + id + "/256/png8";
            return url;
        },
        start_move: function(){
            this.moving = true;
        },
        stop_move: function(){
            this.moving = false;
            this.render();
        },
        is_moving: function(){
            return this.moving;  
        },
        pan: function(offset_x, offset_y) {
            this.topleft = this.topleft.offset(new ScreenOffsetCoordinate(this, offset_x, offset_y));
        },
        zoom_in_at: function(offset_x, offset_y) {
            this._topleft = this._topleft.offset(new ScreenOffsetCoordinate(this, offset_x/2, offset_y/2)); // not to evoke render() twice
            this.zoomlevel += 1;
        },
        zoom_out_at: function(offset_x, offset_y) {
            this._topleft = this._topleft.offset(new ScreenOffsetCoordinate(this, -1*offset_x, -1*offset_y)); // not to evoke render() twice
            this.zoomlevel -= 1;
        }


    };

    var map = new Map(document.getElementById('mymap'), {
        zoomlevel: 16
    });
    var on = function(id, ev, cb) {
        document.getElementById(id).addEventListener(ev, cb, true);

    };
    var click = function(id, cb) {
        on(id, 'click', cb);
    }
    click('zoomin', function() {
        map.zoomlevel += 1;
    });
    click('zoomout', function() {
        map.zoomlevel -= 1;
    });
    click('panwest', function() {
        map.pan(-15, 0);
    });
    click('paneast', function() {
        map.pan(15, 0);
    });
    click('pannorth', function() {
        map.pan(0, -15);
    });
    click('pansouth', function() {
        map.pan(0, 15);
    });

    var mouse_last_x, mouse_last_y;
    on('mymap', 'mousedown', function(ev) {
        map.start_move();
        mouse_last_x = ev.pageX;
        mouse_last_y = ev.pageY;
    });

    on('mymap', 'mouseup', function() {
        map.stop_move();
    });

    on('mymap', 'mouseout', function() {
        map.stop_move();
    });

    on('mymap', 'mousemove', function(ev) {
        if (map.is_moving()) {
            var offset_x = mouse_last_x - ev.pageX;
            var offset_y = mouse_last_y - ev.pageY;

            map.pan(offset_x, offset_y);

            mouse_last_x = ev.pageX;
            mouse_last_y = ev.pageY;

        }
    });

    on('mymap', 'dblclick', function(ev) {
        map.zoom_in_at(ev.offsetX, ev.offsetY);
    });
    on('mymap', 'contextmenu', function(ev) {
        map.zoom_out_at(ev.offsetX, ev.offsetY);
        return false;
    });
    var mouse_wheel_enabled = true;
    on('mymap', 'mousewheel', function(ev) {
        if (mouse_wheel_enabled) {
            var wheel_property;
            if (ev.wheelDelta) wheel_property = ev.wheelDelta;
            if (ev.detail) wheel_property = (-1) * ev.detail;
            if (wheel_property > 0) {
                map.zoom_in_at(ev.offsetX, ev.offsetY);
            } else if (wheel_property < 0) {
                map.zoom_out_at(ev.offsetX, ev.offsetY);
            }
            mouse_wheel_enabled = false;
            window.setTimeout(function() {
                mouse_wheel_enabled = true;
            }, 100);
        }
    });

})();
