# Contact sheet of screenshots: python3 tools/grid.py <dir> name1,name2,... [cols]  -> <dir>/grid.png
import sys
from PIL import Image
d=sys.argv[1];ns=sys.argv[2].split(',');c=int(sys.argv[3]) if len(sys.argv)>3 else 3
ims=[Image.open(f'{d}/{n}.png').resize((260,563)) for n in ns]
r=(len(ims)+c-1)//c
W=Image.new('RGB',(260*c,563*r))
for i,im in enumerate(ims):W.paste(im,((i%c)*260,(i//c)*563))
W.save(f'{d}/grid.png')
