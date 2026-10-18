import os,sys
SP=os.path.dirname(os.path.abspath(__file__))
ds=os.environ.get('DATASET','jp')
src=open(SP+'/gen83_head.py').read()+'\n'+open(SP+'/z83_core.py').read()+'\n'+open(SP+'/z83_%s.py'%ds).read()+'\n'+open(SP+'/z83_prep.py').read()+'\n'+open(SP+'/z83_build.py').read()
open(SP+'/gen83_%s_full.py'%ds,'w').write(src)
g={'__file__':SP+'/gen83_%s_full.py'%ds,'__name__':'__main__'}
exec(compile(src,SP+'/gen83_%s_full.py'%ds,'exec'),g)
