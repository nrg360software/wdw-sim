# Usage: python3 tools/ak_walk.py -> prints Animal Kingdom real node/ride coordinates (PARKS.AK.real / rideReal / rideAt).
# Walkways traced on project image IMG_8730 (Google satellite, 1320x1908; scale bar 0.885 m/px) with the 2026 guidemap (DAK-0325) projected
# onto it by an affine fit (~22 m residual), then hand-corrected where the satellite paths are visible (Oasis, DI south, Pandora bridge).
# Pixel -> world: similarity fit of Google pins (Kili, Na'vi, Conservation Station, Harambe station) onto Disney's own attraction
# coordinates (ThemeParks.wiki AK park 1c84a229-8862-4648-9c71-378ddd2c7693 /children, Nov 21 2026): 0.873 m/px, -0.3 deg, 12-16 m residual.
import json,math
C=(-752,886);SC=0.85
Z=complex(0.26183461299715394,-0.0015519385607596665);PC=(718.5,1101.25);WC=(-764.38806722,831.53282807)
def wll(la,lo): return ((lo+81.565)*29383, -(la-28.385)*33171)
def loc_w(X,Y): return [round((X-C[0])/SC,1), round((Y-C[1])/SC,1)]
def loc_p(p):
  w=complex(p[0]-PC[0],p[1]-PC[1])*Z; return loc_w(w.real+WC[0], w.imag+WC[1])
DIS={'fop':(28.355554,-81.592147),'navi':(28.355257,-81.591641),'ee':(28.3584769119,-81.5873781396),'kili':(28.359331,-81.59228),
 'krr':(28.3587834288,-81.5889412165),'zoo':(28.357488,-81.590118),'flk':(28.35811,-81.592643)}
PX={ # node: pixel on IMG_8730
 'ent':(812,1662),'oW':(772,1572),'oE':(838,1575),'oasis':(795,1510),'diS':(788,1428),'di':(800,1385),'diW':(700,1445),'diNW':(648,1325),
 'diN':(845,1328),'diE':(900,1451),'tree':(790,1290),'pB':(654,1586),'pan':(612,1594),'pNW':(585,1524),'wR':(545,1376),'flkF':(565,1315),
 'afr':(633,1269),'har':(622,1218),'kiliF':(603,1166),'aaM':(762,1254),'asia':(850,1265),'asM':(936,1239),'asE':(1066,1248),'asEv':(1127,1266),'dino':(959,1472),'pS':(640,1662)}
AT={'fop':'pan','navi':'pS','ee':'asEv','kili':'kiliF','krr':'asM','zoo':'di','flk':'flkF'}
LINKS=[('ent','oW'),('ent','oE'),('oW','oasis'),('oE','oasis'),('oasis','diS'),('diS','di'),('diS','diW'),('diS','diE'),('di','diN'),('di','tree'),
 ('diW','diNW'),('diW','pB'),('pB','pan'),('pan','pNW'),('pNW','wR'),('wR','flkF'),('flkF','afr'),('diNW','afr'),('diNW','tree'),('tree','diN'),
 ('diN','diE'),('diN','asia'),('afr','har'),('har','kiliF'),('har','aaM'),('aaM','asia'),('asia','asM'),('asM','asE'),('asE','asEv'),('diE','dino'),('pB','pS')]
REAL={k:loc_p(v) for k,v in PX.items()}
RR={k:loc_w(*wll(*v)) for k,v in DIS.items()}
if __name__=='__main__':
  U=0.3/SC;tot=sum(math.hypot(REAL[a][0]-REAL[b][0],REAL[a][1]-REAL[b][1]) for a,b in LINKS)/U
  print('network metres',round(tot))
  for k in AT:print(k,'link m',round(math.hypot(RR[k][0]-REAL[AT[k]][0],RR[k][1]-REAL[AT[k]][1])/U))
  print('real:',json.dumps(REAL,separators=(',',':')));print('rideReal:',json.dumps(RR,separators=(',',':')));print('rideAt:',json.dumps(AT,separators=(',',':')))
  print('links:',json.dumps(LINKS,separators=(',',':')).replace('"',"'"))
