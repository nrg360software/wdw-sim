# Usage: python3 tools/hs_walk.py -> prints Hollywood Studios real node/ride coordinates (PARKS.HS.real / rideReal) and a thin-plate-spline art guess for new waypoints.
# Traced on project image IMG_8731 (Google satellite, 1320x1903). Scale 0.595 m/px from the map's scale bar (500 ft and 100 m ticks agree).
import json,math
ROT=-math.pi*0.75; SC=0.75; C=(154,929)
# Pixel -> world: similarity fit of the traced ride spots onto Disney's own attraction coordinates (ThemeParks.wiki, Nov 21 2026):
# 0.597 m/px, 0.7 deg rotation, rides agree within ~10 m (MMRR 24 m: Disney's point is the theatre's middle).
FZ=complex(0.1791952,0.0022456)
DIS={'sdd':(28.356245,-81.562786),'ass':(28.355385,-81.562379),'mmrr':(28.3566783801,-81.5605667783),'rotr':(28.354884,-81.560457),
 'st':(28.355695,-81.558891),'frz':(28.3568243,-81.559694),'msr':(28.353889,-81.561689),'tot':(28.359553,-81.559772),'tsm':(28.356404,-81.561894),
 'rnrc':(28.359712,-81.56059),'bob':(28.3589163,-81.559599),'indy':(28.3566701,-81.558611),'lmm':(28.3574862,-81.560848)}
def wll(la,lo): return ((lo+81.565)*29383, -(la-28.385)*33171)
def tolocal(X,Z):
  X-=C[0];Z-=C[1];c,s=math.cos(ROT),math.sin(ROT); return [round((X*c+Z*s)/SC,1), round((-X*s+Z*c)/SC,1)]
PX={ # node: pixel on IMG_8731 (paths read off the satellite; ride spots checked against the 2026 guidemap via a 7-point affine fit, ~20-45 px residual)
 'ent':(928,682),'hb':(862,748),'hbS':(790,822),'cen':(680,912),'sun':(788,655),'sunE':(728,522),'sunW':(625,525),
 'echoN':(812,860),'echo':(772,928),'echoE':(902,942),'echoS':(852,1012),'stP':(885,1120),
 'com':(712,1047),'gaN':(782,1195),'geE':(690,1290),'ge':(470,1430),'geN':(372,1292),
 'anim':(560,875),'pix':(590,1040),'tsl':(428,1040),'tslC':(330,1140),
}
RIDE={ # ride entrance / queue pixel, node
 'rotr':((644,1311),'geE'),'msr':((445,1500),'ge'),'sdd':((262,1098),'tslC'),'ass':((310,1212),'tslC'),'tsm':((400,1032),'tsl'),
 'mmrr':((632,945),'cen'),'tot':((728,455),'sunE'),'rnrc':((622,440),'sunW'),'bob':((775,555),'sunE'),
 'st':((905,1172),'stP'),'indy':((935,1000),'echoE'),'frz':((770,958),'echo'),'lmm':((550,828),'anim'),
}
LINKS=[('ent','hb'),('hb','hbS'),('hbS','cen'),('hb','sun'),('sun','sunE'),('sunE','sunW'),('hbS','echoN'),('echoN','echo'),('cen','echo'),
 ('echoN','echoE'),('echo','echoS'),('echoE','echoS'),('echoS','stP'),('cen','com'),('echo','com'),('com','gaN'),('stP','gaN'),
 ('gaN','geE'),('geE','ge'),('ge','geN'),('geN','tslC'),('tslC','tsl'),('tsl','pix'),('pix','com'),('pix','anim'),('anim','cen')]
_q=[wll(*DIS[k]) for k in DIS]; QC=(sum(q[0] for q in _q)/len(_q), sum(q[1] for q in _q)/len(_q))
_p=[RIDE[k][0] for k in DIS]; PC=(sum(p[0] for p in _p)/len(_p), sum(p[1] for p in _p)/len(_p))
def loc(p):
  w=complex(p[0]-PC[0],p[1]-PC[1])*FZ; return tolocal(w.real+QC[0], w.imag+QC[1])
REAL={k:loc(v) for k,v in PX.items()}
RR={k:tolocal(*wll(*DIS[k])) for k in RIDE}   # Disney's points
AT={k:v[1] for k,v in RIDE.items()}
if __name__=='__main__':
  tot=0
  for a,b in LINKS:
    A,B=REAL[a],REAL[b];tot+=math.hypot(A[0]-B[0],A[1]-B[1])/0.4
  print('network metres',round(tot))
  print('real:',json.dumps(REAL,separators=(',',':')));print('rideReal:',json.dumps(RR,separators=(',',':')));print('rideAt:',json.dumps(AT,separators=(',',':')))
