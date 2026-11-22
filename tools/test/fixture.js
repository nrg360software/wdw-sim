// Builds ThemeParks.wiki-style /live JSON for a given date from what the feed showed on Nov 21-22, 2026.
const P=(n,times,o={})=>({n,times,...o});
const D={
MK:[P('Meet Ariel at Her Grotto',[['10:00','19:00']],{q:30,op:1}),P("Meet Mickey at Town Square Theater",[['09:00','22:30']],{q:10,op:1}),
 P('Meet Cinderella and Princess Tiana at Princess Fairytale Hall',[['09:00','21:00']],{q:35,op:1}),
 P("Mickey's Once Upon a Christmastime Parade",[],{st:'CLOSED'}),P('Flag Retreat',['17:00']),P('The Dapper Dans',['09:00','09:50','10:40','12:05','13:10','14:55','15:55']),
 P('Happily Ever After',['20:00']),P('Frozen Holiday Surprise',['18:15']),P("Mickey's Magical Friendship Faire",['10:00','11:35','12:45','14:55','16:00']),
 P('Disney Starlight: Dream the Night Away',['18:45','21:00']),P('Casey\'s Corner Pianist',['10:50','12:00','13:15','14:35']),
 P('Disney Festival of Fantasy Parade',['14:00']),P('Disney Adventure Friends Cavalcade',['11:05']),
 P("Meet Santa Jack and Sally at Mickey's Very Merry Christmas Party",[['19:00','23:30']],{tk:1})],
EP:[P('Meet Pluto Near EPCOT Main Entrance',['09:00','09:30','10:00','10:30','11:00','13:45','14:15']),P('Meet Princess Aurora in France',['10:45','11:55','13:50','15:00']),
 P('Luminous The Symphony of Us',['21:00']),P('Matsuriza',['11:00','12:00','13:00','14:00','15:00','16:00','16:45']),P('Voices of Liberty',['11:15','12:00','12:45','13:30']),
 P('¡Celebración Encanto!',['09:45','10:45','11:45','13:30','14:30','15:30']),P('Meet Figment Inside ImageWorks',[['09:00','12:30'],['13:45','15:45']])],
HS:[P('Meet Olaf at Celebrity Spotlight',[['09:00','17:30']],{q:10,op:1}),P('Fantasmic!',['18:30']),
 P('Glisten! at Disney Jollywood Nights',['20:05','21:05','22:30','23:15','00:15'],{tk:1}),
 P('Beauty and the Beast – Live on Stage',['11:00','12:00','13:00','14:30','15:30']),
 P('The Little Mermaid – A Musical Adventure',['10:00','10:35','11:10','11:45','12:20','12:55','13:30','14:05','14:40','15:50','16:25','17:00','17:35','18:10','18:45']),
 P('Indiana Jones™ Epic Stunt Spectacular!',['10:45','12:00','13:15','15:15','16:30']),
 P('For the First Time in Forever: A Frozen Sing-Along Celebration',['09:00','10:00','11:00','12:00','13:00','14:00','15:00','15:50']),
 P('Disney Villains: Unfairly Ever After',['10:30','11:10','11:50','12:30','13:10','13:50','14:30','15:10','15:50','16:30','17:10','17:50','18:30']),
 P('Green Army Drum Corps',['10:00','11:00','12:00','14:00','15:00','16:00'])],
AK:[P('Tree of Life Awakenings',[['18:00','19:30']]),P('Festival of the Lion King',['10:00','11:00','12:00','13:00','14:00','15:00','16:00']),
 P('Merry Menagerie',[['09:45','12:35'],['13:25','17:10']],{op:1}),P('Finding Nemo: The Big Blue... and Beyond!',['11:00','12:00','13:00','14:30','15:30','16:30']),
 P('Meet Moana at Character Landing',[['08:30','12:15'],['13:45','15:45']],{q:20,op:1}),P('Kora Tinga Tinga',['10:45','11:45','12:45'])]};
function nextDay(d){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10)}
function build(pk,date){return{id:'x',name:pk,liveData:D[pk].map((e,i)=>{const st=[];
  for(const t of e.times){const iso=h=>{const dd=+h.slice(0,2)<4?nextDay(date):date;return `${dd}T${h}:00-05:00`};
    if(Array.isArray(t))st.push({type:e.tk?'Special Ticketed Event':e.op?'Operating':'Performance Time',startTime:iso(t[0]),endTime:iso(t[1])});
    else st.push({type:e.tk?'Special Ticketed Event':'Performance Time',startTime:iso(t),endTime:iso(t)})}
  const o={id:pk+'-'+i,name:e.n,entityType:'SHOW',status:e.st||'OPERATING',showtimes:st,lastUpdated:date+'T10:00:00-05:00'};if(e.q!=null)o.queue={STANDBY:{waitTime:e.q}};return o})}}
module.exports={build};
