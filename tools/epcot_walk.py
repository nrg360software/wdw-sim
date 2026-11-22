# Usage: python3 tools/epcot_walk.py  -> prints EPCOT real node/ride coordinates (PARKS.EP.real / rideReal). Paths traced on project image IMG_8733, fitted to Disney points.
# EPCOT real walkway network traced on IMG_8733 (Google satellite, 0.84 m/px, Spaceship Earth pin at (650,400)).
import json,math
S=0.91; X0=653.5; Y0=954.0; K=S*0.24   # park-local units per px (EPCOT sc 1.25 -> 0.3 world/m); scale from the 40-acre lagoon, the 1.2-mile promenade and Frozen/AA/IG points
# Nov 21 (later): refit to Disney's attraction points (ThemeParks.wiki) -> 0.926 m/px, 1.2 deg rotation; similarity px -> park-local
FA,FB,FX,FY=0.22211468131936346,0.004638812060401154,-140.90486353865316,-215.58470827033497
def loc(p): return [round(FA*p[0]-FB*p[1]+FX,1), round(FB*p[0]+FA*p[1]+FY,1)]
DIS={'seas': (28.374904, -81.550852), 'remy': (28.36825, -81.553097), 'fig': (28.372994, -81.551401), 'aa': (28.367517, -81.549446), 'tt': (28.373228, -81.547489), 'fea': (28.370745, -81.54653), 'sse': (28.375583, -81.549401), 'gft': (28.371649, -81.547368), 'msp': (28.373927, -81.547156), 'gotg': (28.3749021961781, -81.5478397673417), 'lwtl': (28.374245, -81.552301), 'soar': (28.373592, -81.552248), 'jow': (28.374691, -81.550378)}
def dloc(ll): return [round((ll[1]+81.54941)*23508,1), round(-(ll[0]-28.37107)*26537,1)]
PX={ # node: pixel on IMG_8733 (1320x1889)
 'ent':(650,285),'se':(650,398),'seW':(606,462),'seE':(694,462),'seS':(650,548),
 'fw':(650,612),'hW':(592,606),'hE':(708,600),
 'fww':(520,598),'wnN':(540,500),'imgN':(505,650),'jow':(0,0),'img':(470,705),'land':(430,585),'seasF':(482,478),
 'fwe':(790,605),'wdN':(835,548),'gxW':(752,488),'ttw':(812,672),
 'hS':(650,702),'hSW':(562,712),'hSE':(816,712),'sp':(650,872),'spE':(830,862),'spW':(548,862),'ukN':(362,985),
 'mex':(872,902),'nor':(908,1015),'chi':(925,1110),'ger':(975,1212),'ita':(905,1300),'usa':(650,1345),
 'jap':(520,1345),'mor':(420,1322),'fra':(322,1252),'ig':(278,1195),'uk':(322,1085),'can':(425,905),
}
RIDE={ # ride entrance pixel, node (Soarin', Living with the Land and The Seas sit inside their pavilions: the point is how far in the queue/ride exit is from the door)
 'gotg':((790,512),'wdN'),'msp':((893,522),'wdN'),'tt':((842,690),'ttw'),'sse':((632,428),'se'),
 'seas':((466,442),'seasF'),'soar':((372,676),'land'),'lwtl':((398,612),'land'),'fig':((468,712),'img'),
 'gft':((892,893),'mex'),'fea':((962,1002),'nor'),'remy':((245,1248),'fra'),'aa':((650,1395),'usa'),
}
LINKS=[('ent','se'),('se','seW'),('se','seE'),('seW','seS'),('seE','seS'),('seS','fw'),
 ('fw','hW'),('hW','fww'),('seW','wnN'),('wnN','seasF'),('wnN','fww'),('seasF','land'),('fww','land'),('fww','imgN'),('imgN','img'),('hW','imgN'),('wnN','jow'),('jow','fww'),
 ('fw','hE'),('hE','fwe'),('fwe','wdN'),('seE','gxW'),('gxW','wdN'),('fwe','ttw'),('ttw','hSE'),
 ('fw','hS'),('hS','hSW'),('hS','hSE'),('hSW','spW'),('hSE','spE'),('sp','spE'),('sp','spW'),('spE','mex'),('img','hSW'),('spW','can'),
 ('mex','nor'),('nor','chi'),('chi','ger'),('ger','ita'),('ita','usa'),('usa','jap'),('jap','mor'),('mor','fra'),('fra','ig'),('ig','uk'),('uk','ukN'),('ukN','can')]
REAL={k:loc(v) for k,v in PX.items()}
REAL['jow']=dloc(DIS['jow'])  # Journey of Water: Disney's point
RR={k:dloc(DIS[k]) for k in RIDE}  # ride points = Disney's coordinates
AT={k:v[1] for k,v in RIDE.items()}
if __name__=='__main__':
  tot=0
  for a,b in LINKS:
    A,B=REAL[a],REAL[b];d=math.hypot(A[0]-B[0],A[1]-B[1])/0.24;tot+=d
  print('network metres',round(tot))
  print(json.dumps(REAL));print(json.dumps(RR))
