import Holidays from 'date-holidays'
import moment from 'moment-timezone'
import ical from 'date-holidays-ical'
import fs from 'fs'

function gen(area, names, tz){
    const hd = new Holidays();
    hd.init(...area);

    const first_days = [];
    const last_days = [];
    let cur = moment().tz(tz).set({
        "month": 0,
        "date": 1,
        "hour": 0,
        "minute": 0,
        "second": 0,
        "millisecond": 0
    });
    cur.set("year", cur.year()-1);
    for(const i of Array(36)){
        for(const d in Array(31)){
            const hits = hd.isHoliday(cur);
            if((hits && hits.filter(e=>e.type=="public")) || [0,6].includes(cur.day())){
                cur = cur.add(1, "day");
            }else{
                break;
            }
        }
        first_days.push(moment(cur));
        cur = cur.set("date", 1).add(1, "month");

        cur = cur.subtract(1, "day");
        for(const d in Array(31)){
            const hits = hd.isHoliday(cur);
            if((hits && hits.filter(e=>e.type=="public")) || [0,6].includes(cur.day())){
                cur = cur.subtract(1, "day");
            }else{
                break;
            }
        }
        last_days.push(moment(cur));
        cur = cur.set("date", 1).add(1, "month");
    }
    return {
        area,
        tz,
        names,
        first_days,
        last_days,
    }
}

function* walker(){
    const hd = new Holidays();
    for(const [c,cname] of Object.entries(hd.getCountries())){
        for(const x of area_walker([c],[cname])){
            yield x;
        }
        const st = hd.getStates(c);
        if(st){
            for(const [s,sname] of Object.entries(st)){
                for(const x of area_walker([c,s], [cname, sname])){
                    yield x;
                }
                const rs = hd.getRegions(c,s);
                if(rs){
                    for(const [r,rname] of Object.entries(rs)){
                        for(const x of area_walker([c,s,r], [cname, sname, rname])){
                            yield x;
                        }
                    }
                }
            }
        }
    }
}

function* area_walker(area, names){
    const hd = new Holidays();
    hd.init(...area);
    for(const tz of hd.getTimezones()){
        yield gen(area, names, tz);
    }
}

const outdir="docs";
let md = [
    "# First working day and last working day calendar",
    "Thanks to date-holidays library, ics are is auto-generated.",
    "The first day of the year and the last of the year are removed, ",
    "because special additional local rules may appear.",
    "",
    "## ics and json",
];
for(const x of walker()){
    const {
        area,
        tz,
        names,
        first_days,
        last_days
    } = x;

    const file_prefix = `${ area.join("-") }_${ tz.replaceAll("/","_") }`;

    md = md.concat([
        `- ${ names.join(" ") } @ ${ tz }`,
        `  - first days [ics](${ file_prefix }_first.ics) [json](${ file_prefix }_first.json)`,
        `  - last days [ics](${ file_prefix }_last.ics) [json](${ file_prefix }_last.json)`,
    ])

    const first_content = first_days.filter(d=>{
        return ![0,11].includes(d.month())
    });
    fs.writeFileSync(`${outdir}/${file_prefix}_first.json`,
        JSON.stringify(first_content.map(d=> d.format("YYYYMMDD")))
    );
    fs.writeFileSync(`${outdir}/${file_prefix}_first.ics`,
        ical.vcalendar(first_content.map(d=>{
            return {
                name: names.concat(["first working day"]).join(", "),
                date: d,
                start: d,
                end: moment(d).add(1, "day")
            }
        }), {fullday: true})
    );

    const last_content = last_days.filter(d=>{
        return ![0,11].includes(d.month())
    });
    fs.writeFileSync(`${outdir}/${file_prefix}_last.json`,
        JSON.stringify(last_content.map(d=>d.toString("YYYYMMDD")))
    );
    fs.writeFileSync(`${outdir}/${file_prefix}_last.ics`,
        ical.vcalendar(last_content.map(d=>{
            return {
                name: names.concat(["last working day"]).join(", "),
                date: d.toString("YYYYMMDD"),
                start: d,
                end: moment(d).add(1, "day")
            }
        }), {fullday: true})
    );
}
fs.writeFileSync(`${outdir}/index.md`, md.join("\n"));
