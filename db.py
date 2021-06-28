from rethinkdb import RethinkDB
r = RethinkDB()

import zipcodes

try:
    conn = r.connect(db='myownpd')
    conn.use('myownpd')
    # r.table_drop('zips').run(conn)
    # r.table_drop('locations').run(conn)
    r.table_create('zips', primary_key="zip").run(conn)
    # r.table_create('locations').run(conn)
    # r.table('locations').index_create('queries', multi=True).run(conn)
except BaseException as e:
    pass

class Db:

    conn = conn

    @classmethod
    def open(cls):
        cls.conn = r.connect(db='myownpd')
        cls.conn.use('myownpd')

    @classmethod
    def close(cls):
        cls.conn.close()

    @staticmethod
    def loc_conflict(id, old, new):
        old["queries"].set_union(new["queries"])
        old.update({"hours": new["hours"]})
        return old

    @classmethod
    def get_loc(cls, loc_id):
        return r.table('locations').get(loc_id).run(cls.conn)

    @classmethod
    def set_zip(cls, zip, coords):
        return r.table("zips").insert(
            {
                "zip": zip,
                "coords": coords,
            },
            conflict="error"
        ).run(cls.conn)["inserted"]

    @classmethod
    def set_locations(cls, locations, query):
        r.table("locations").insert(
            [{**loc, "queries": [query]} for loc in locations],
            conflict=cls.loc_conflict,
            return_changes=True
        ).run(cls.conn)

    @classmethod
    def get_zip(cls, orig_zip):
        zippy = r.table('zips').get(orig_zip).run(cls.conn)
        if not zippy:
            result = zipcodes.matching(orig_zip)
            if result:
                long = float(result[0]['long'])
                lat = float(result[0]['lat'])
                zippy = {"zip": orig_zip, "coords": [long, lat]}
            else:
                zippy = None
        # else:
        #     locations = r.table("locations").get_all(orig_zip, index="queries").coerce_to('array').run(cls.conn)
        #     zippy["locations"] = locations
        return zippy or {}

    @classmethod
    def insert(cls, zip, coords):
        cls.set_zip(zip, coords)
