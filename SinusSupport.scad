

include<supportPathData.scad>

//this Module creates the support by extruding a circle along the Path of
// the supportPath variable which is defined in the supportPathData.scad file
//which is exported by sinussupport.html 

module supportbase(thick=.2)
{   
for(e=[0:1:len(supportPath)-2])
    {
        hull()
        {
        translate([supportPath[e][0],supportPath[e][1],0])circle(thick);
        translate([supportPath[e+1][0],supportPath[e+1][1],0])circle(thick);
        }
    }
}   

//Create support and the Model Here
//-----------------------------------------------------------------------------
//make the support 10 mm high
linear_extrude(height = 10)supportbase();

//we can add the original model 
rotate([0,0,-90])import("..//GripHandle-Joint-Shell-topPart.scad.stl");