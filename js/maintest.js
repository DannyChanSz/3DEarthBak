var masterContainer = document.getElementById('visualization');

var overlay = document.getElementById('visualization');

var mapIndexedImage;
var mapOutlineImage;
var $body = $("body");

//	where in html to hold all our things
var glContainer = document.getElementById( 'glContainer' );

//	contains a list of country codes with their matching country names
var isoFile = 'country_iso3166.json';
var latlonFile = 'country_lat_lon.json'

var camera, scene, renderer, controls;

var pinsBase, pinsBaseMat;
var lookupCanvas
var lookupTexture;
var backTexture;
var worldCanvas;
var sphere;
var rotating;	
var visualizationMesh;							

var mapUniforms;

//	contains the data loaded from the arms data file
//	contains a list of years, followed by trades within that year
//	properties for each "trade" is: e - exporter, i - importer, v - value (USD), wc - weapons code (see table)

//	contains latlon data for each country
var latlonData;	

var attackData;		    

//	contains above but organized as a mapped list via ['countryname'] = countryobject
//	each country object has data like center of country in 3d space, lat lon, country name, and country code
var countryData = new Object();		

//	contains a list of country code to country name for running lookups
var countryLookup;		    

var selectableYears = [];
var selectableCountries = [];

var attackTarget = { lon: 121.36, lat: 31.21 };
//31.2197050000,121.3676340000

/*
	930100 – military weapons, and includes some light weapons and artillery as well as machine guns and assault rifles etc.  
	930190 – military firearms – eg assault rifles, machineguns (sub, light, heavy etc), combat shotguns, machine pistols etc
	930200 – pistols and revolvers
	930320 – Sporting shotguns (anything that isn’t rated as a military item).
	930330 – Sporting rifles (basically anything that isn’t fully automatic).
	930621 – shotgun shells
	930630 – small caliber ammo (anything below 14.5mm which isn’t fired from a shotgun.
*/

//	a list of weapon 'codes'
//	now they are just strings of categories
//	Category Name : Category Code
var weaponLookup = {
	'Military Weapons' 		: 'mil',
	'Civilian Weapons'		: 'civ',
	'Ammunition'			: 'ammo',
};

var lineMaterial = new THREE.LineBasicMaterial( 
	{ 	color: 0xffffff, opacity: 1.0, blending: 
		THREE.AdditiveBlending, transparent:true, 
		depthWrite: false, vertexColors: true, 
		linewidth: 1 } );

//	a list of the reverse for easy lookup
var reverseWeaponLookup = new Object();
for( var i in weaponLookup ){
	var name = i;
	var code = weaponLookup[i];
	reverseWeaponLookup[code] = name;
}	    	

//	A list of category colors
var categoryColors = {
	'mil' : 0xdd380c,
	'civ' : 0x3dba00,
	'ammo' : 0x154492,
}

var exportColor = 0xdd380c;
var importColor = 0x154492;

//	the currently selected country
var selectedCountry = null;
var previouslySelectedCountry = null;

//	contains info about what year, what countries, categories, etc that's being visualized
var selectionData;

//	TODO
//	use underscore and ".after" to load these in order
//	don't look at me I'm ugly
function start( e ){	
	//	detect for webgl and reject everything else
	if ( ! Detector.webgl ) {
		Detector.addGetWebGLMessage();
	}
	else{
		//	ensure the map images are loaded first!!
		mapIndexedImage = new Image();
		mapIndexedImage.src = 'images/map_indexed.png';
		mapIndexedImage.onload = function() {
			mapOutlineImage = new Image();
			mapOutlineImage.src = 'images/map_outline.png';
			mapOutlineImage.onload = function(){
				loadCountryCodes(
					function(){
						loadWorldPins(
							function(){										
								loadAttackData(								
									function(){																	
										initScene();
										animate();		
									}
								);														
							}
						);
					}
				);
			};			
		};		
	};
}	



//	-----------------------------------------------------------------------------
//	All the initialization stuff for THREE
function initScene() {

	//	-----------------------------------------------------------------------------
    //	Let's make a scene		
	scene = new THREE.Scene();
	scene.matrixAutoUpdate = false;		
	// scene.fog = new THREE.FogExp2( 0xBBBBBB, 0.00003 );		        		       

	scene.add( new THREE.AmbientLight( 0x505050 ) );				

	light1 = new THREE.SpotLight( 0xeeeeee, 3 );
	light1.position.x = 730; 
	light1.position.y = 520;
	light1.position.z = 626;
	light1.castShadow = true;
	scene.add( light1 );

	light2 = new THREE.PointLight( 0x222222, 14.8 );
	light2.position.x = -640;
	light2.position.y = -500;
	light2.position.z = -1000;
	scene.add( light2 );				

	rotating = new THREE.Object3D();
	scene.add(rotating);

	lookupCanvas = document.createElement('canvas');	
	lookupCanvas.width = 256;
	lookupCanvas.height = 1;
	
	lookupTexture = new THREE.Texture( lookupCanvas );
	lookupTexture.magFilter = THREE.NearestFilter;
	lookupTexture.minFilter = THREE.NearestFilter;
	lookupTexture.needsUpdate = true;

	var indexedMapTexture = new THREE.Texture( mapIndexedImage );
	//THREE.ImageUtils.loadTexture( 'images/map_indexed.png' );
	indexedMapTexture.needsUpdate = true;
	indexedMapTexture.magFilter = THREE.NearestFilter;
	indexedMapTexture.minFilter = THREE.NearestFilter;

	var outlinedMapTexture = new THREE.Texture( mapOutlineImage );
	outlinedMapTexture.needsUpdate = true;
	// outlinedMapTexture.magFilter = THREE.NearestFilter;
	// outlinedMapTexture.minFilter = THREE.NearestFilter;

	var uniforms = {
		'mapIndex': { type: 't', value: 0, texture: indexedMapTexture  },		
		'lookup': { type: 't', value: 1, texture: lookupTexture },
		'outline': { type: 't', value: 2, texture: outlinedMapTexture },
		'outlineLevel': {type: 'f', value: 1 },
	};
	mapUniforms = uniforms;

	// 自定义着色器创建材质类型
	var shaderMaterial = new THREE.ShaderMaterial( {

		uniforms: 		uniforms,
		// attributes:     attributes,
		vertexShader:   document.getElementById( 'globeVertexShader' ).textContent,
		fragmentShader: document.getElementById( 'globeFragmentShader' ).textContent,
		// sizeAttenuation: true,
	});


    //	-----------------------------------------------------------------------------
    //	Create the backing (sphere)
    // var mapGraphic = new THREE.Texture(worldCanvas);//THREE.ImageUtils.loadTexture("images/map.png");
    // backTexture =  mapGraphic;
    // mapGraphic.needsUpdate = true;
    // mesh(网格)的基本材质材质
	backMat = new THREE.MeshBasicMaterial(
		{
			// color: 		0xffffff, 
			// shininess: 	10, 
// 			specular: 	0x333333,
			// map: 		mapGraphic,
			// lightMap: 	mapGraphic
		}
	);				
	// backMat.ambient = new THREE.Color(255,255,255);							
	sphere = new THREE.Mesh( new THREE.SphereGeometry( 100, 40, 40 ), shaderMaterial );				
	// sphere.receiveShadow = true;
	// sphere.castShadow = true;
	sphere.doubleSided = false;
	sphere.rotation.x = Math.PI;				
	sphere.rotation.y = -Math.PI/2;
	sphere.rotation.z = Math.PI;
	sphere.id = "base";	
	rotating.add( sphere );	

	// load geo data (country lat lons in this case)
	console.time('loadGeoData');	
	loadGeoData( attackTarget );
	loadContryGeoData( latlonData );	

	console.timeEnd('loadGeoData');				

	var loadLayer = document.getElementById('loading');
	loadLayer.style.display = 'none';

	visualizationMesh = new THREE.Object3D();
	rotating.add(visualizationMesh);
				
	highlightCountry();

	selectedCountry = countryData["CHINA"];

	initRotate( selectedCountry );

    //	-----------------------------------------------------------------------------
    //	Setup our renderer
	renderer = new THREE.WebGLRenderer({antialias:false});
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.autoClear = false;
	
	renderer.sortObjects = false;		
	renderer.generateMipmaps = false;					

	glContainer.appendChild( renderer.domElement );									


    //	-----------------------------------------------------------------------------
    //	Event listeners
	document.addEventListener( 'mousemove', onDocumentMouseMove, true );
	document.addEventListener( 'windowResize', onDocumentResize, false );

	//masterContainer.addEventListener( 'mousedown', onDocumentMouseDown, true );	
	//masterContainer.addEventListener( 'mouseup', onDocumentMouseUp, false );	
	document.addEventListener( 'mousedown', onDocumentMouseDown, true );	
	document.addEventListener( 'mouseup', onDocumentMouseUp, false );	
	
	masterContainer.addEventListener( 'click', onClick, true );	
	masterContainer.addEventListener( 'mousewheel', onMouseWheel, false );
	
	//	firefox	
	masterContainer.addEventListener( 'DOMMouseScroll', function(e){
		    var evt=window.event || e; //equalize event object
    		onMouseWheel(evt);
	}, false );

	document.addEventListener( 'keydown', onKeyDown, false);												    			    	

    //	-----------------------------------------------------------------------------
    //	Setup our camera
    camera = new THREE.PerspectiveCamera( 12, window.innerWidth / window.innerHeight, 1, 20000 ); 		        
	camera.position.z = 1400;
	camera.position.y = 0;
	camera.position.x = 100;
	camera.lookAt(scene.width/2, scene.height/2);
	scene.add( camera );

	var windowResize = THREEx.WindowResize(renderer, camera)		
}

var initRotate = function(selectedCountry) {
	if( selectedCountry ){
		rotateTargetX = selectedCountry.lat * Math.PI/180;
		var targetY0 = -(selectedCountry.lon - 9) * Math.PI / 180;
	    var piCounter = 0;
		while(true) {
	        var targetY0Neg = targetY0 - Math.PI * 2 * piCounter;
	        var targetY0Pos = targetY0 + Math.PI * 2 * piCounter;
	        if(Math.abs(targetY0Neg - rotating.rotation.y) < Math.PI) {
	            rotateTargetY = targetY0Neg;
	            break;
	        } else if(Math.abs(targetY0Pos - rotating.rotation.y) < Math.PI) {
	            rotateTargetY = targetY0Pos;
	            break;
	        }
	        piCounter++;
	        rotateTargetY = wrap(targetY0, -Math.PI, Math.PI);
		}
	    // console.log(rotateTargetY);
	    //lines commented below source of rotation error
		//is there a more reliable way to ensure we don't rotate around the globe too much? 
		/*
		if( Math.abs(rotateTargetY - rotating.rotation.y) > Math.PI )
			rotateTargetY += Math.PI;		
		*/
		rotateVX *= 0.6;
		rotateVY *= 0.6;		
	}	
}

var loadContryGeoData = function( latlonData ){
    //	-----------------------------------------------------------------------------
    //	Load the world geo data json, per country	

	var sphereRad = 1;
	var rad = 100;

	//	iterate through each set of country pins
	for ( var i in latlonData.countries ) {
		var country = latlonData.countries[i];
		
		country.countryCode = i;
		country.countryName = countryLookup[i];			

		//	take the lat lon from the data and convert this to 3d globe space
        var lon = country.lon - 90;
        var lat = country.lat;
        
        var phi = Math.PI/2 - lat * Math.PI / 180 - Math.PI * 0.01;
        var theta = 2 * Math.PI - lon * Math.PI / 180 + Math.PI * 0.06;
		
		var center = new THREE.Vector3();                
        center.x = Math.sin(phi) * Math.cos(theta) * rad;
        center.y = Math.cos(phi) * rad;
        center.z = Math.sin(phi) * Math.sin(theta) * rad;  	
	
		//	save and catalogue       
		country.center = center;
		countryData[country.countryName] = country;	
	}
}

var getLineMesh = function( attackData ) {
	var linesGeo = new THREE.Geometry();
	var lineColors = [];
	var lineMaterial = new THREE.LineBasicMaterial( 
		{ 	color: 0xffffff, opacity: 1.0, blending: 
			THREE.AdditiveBlending, transparent:true, 
			depthWrite: false, vertexColors: true, 
			linewidth: 1 } );	

	var splineOutline;

	for( i in attackData ){
		var set = attackData[i];

		var lineColor = new THREE.Color( 0xe6be14 );

		var lastColor = lineColor;
		//	grab the colors from the vertices
		var geopoints = set.pointlist.slice(0, 5);
		var pointstart = 0, pointlen = 5;
		for( s in geopoints ){	
			lineColors.push(lineColor);
			lastColor = lineColor;
		}

		var curveGeometry = THREE.Curve.Utils.createLineGeometry( geopoints );
		curveGeometry.colors = lineColors;

		splineOutline = new THREE.Line( curveGeometry, lineMaterial);
		splineOutline.pointlist = set.pointlist;
		splineOutline.pointstart = pointstart;
		splineOutline.pointlen = pointlen;

		splineOutline.renderDepth = false;

		splineOutline.update = function() {
			var timetipnow = new Date().getTime();
 
			if(!this.timetip) {
				this.timetip = timetipnow;
			} else if(timetipnow - this.timetip > 1000/240) {
				this.timetip = timetipnow;
				if(this.pointstart < this.pointlist.length) {
					this.pointstart += 1;
					this.geometry.vertices = this.pointlist.slice(this.pointstart, this.pointstart + this.pointlen);
					this.geometry.verticesNeedUpdate = true;
				} else {
					this.parent.remove(this);
				}
			}
		}

		visualizationMesh.add(splineOutline);
	}
}



var loadGeoData = function( attackpoint ){
	var rad = 100;

	//	take the lat lon from the data and convert this to 3d globe space
    var lon = attackpoint.lon - 90;
    var lat = attackpoint.lat;
    
    var phi = Math.PI/2 - lat * Math.PI / 180 - Math.PI * 0.01;
    var theta = 2 * Math.PI - lon * Math.PI / 180 + Math.PI * 0.06;
	
	var center = new THREE.Vector3();                
    center.x = Math.sin(phi) * Math.cos(theta) * rad;
    center.y = Math.cos(phi) * rad;
    center.z = Math.sin(phi) * Math.sin(theta) * rad;  	

	//	save and catalogue       
	attackpoint.center = center;
}	

var vec3_origin = new THREE.Vector3(0,0,0);

// toPoint 31.2197050000,121.3676340000
function connectionTwoPoint(fromPoint, toPoint) {

	var distanceBetweenTwoPoint = fromPoint.center.clone().subSelf(toPoint.center).length();

	var start = fromPoint.center;
	var end = toPoint.center;

	//	midpoint for the curve
	var mid = start.clone().lerpSelf(end,0.5);		
	var midLength = mid.length()
	// normalize 3维向量的单位化（几何意义：转换为长度为1，方向相同的向量）
	mid.normalize();
	// 3维向量与标量s的乘法（几何意义：向量的缩放）
	mid.multiplyScalar( midLength + distanceBetweenTwoPoint * 0.7 );	

	//	the normal from start to end
	var normal = (new THREE.Vector3()).sub(start,end);
	normal.normalize();

	/*				     
				The curve looks like this:
				
				midStartAnchor---- mid ----- midEndAnchor
			  /											  \
			 /											   \
			/												\
	start/anchor 										 end/anchor

		splineCurveA							splineCurveB
	*/

	var distanceHalf = distanceBetweenTwoPoint * 0.5;

	var startAnchor = start;
	var midStartAnchor = mid.clone().addSelf( normal.clone().multiplyScalar( distanceHalf ) );					
	var midEndAnchor = mid.clone().addSelf( normal.clone().multiplyScalar( -distanceHalf ) );
	var endAnchor = end;

	//	now make a bezier curve out of the above like so in the diagram
	var splineCurveA = new THREE.CubicBezierCurve3( start, startAnchor, midStartAnchor, mid);											
	// splineCurveA.updateArcLengths();

	var splineCurveB = new THREE.CubicBezierCurve3( mid, midEndAnchor, endAnchor, end);
	// splineCurveB.updateArcLengths();

	//	how many vertices do we want on this guy? this is for *each* side
	var vertexCountDesired = Math.floor( /*splineCurveA.getLength()*/ distanceBetweenTwoPoint * 0.02 + 6 ) * 2;	

	//	collect the vertices
	var points = splineCurveA.getPoints( vertexCountDesired );

	//	remove the very last point since it will be duplicated on the next half of the curve
	points = points.splice(0,points.length-1);

	points = points.concat( splineCurveB.getPoints( vertexCountDesired ) );

	//	add one final point to the center of the earth
	//	we need this for drawing multiple arcs, but piled into one geometry buffer
	points.push( vec3_origin );
	
	//	create a line geometry out of these
	// var curveGeometry = THREE.Curve.Utils.createLineGeometry( points );
	// curveGeometry.size = 0;

	return points;
}
	

function animate() {
	if( rotateTargetX !== undefined && rotateTargetY !== undefined ){

		rotateVX += (rotateTargetX - rotateX) * 0.012;
		rotateVY += (rotateTargetY - rotateY) * 0.012;

		if( Math.abs(rotateTargetX - rotateX) < 0.1 && Math.abs(rotateTargetY - rotateY) < 0.1 ){
			//0.6108652381980153
			if( Math.abs(rotateTargetX - 0.6) > 0.1) {
				rotateTargetX = 0.6;
			}
			//rotateTargetX = undefined;
			//rotateTargetY = undefined;
			rotateTargetY -= 0.01;

			rotateVX *= 0.6;
			rotateVY *= 0.6;
		}
	} else if(!dragging) {
		rotateTargetX = 0.6;
		rotateTargetY -= 0.1;
	}


	rotateY += rotateVY;
	rotateX += rotateVX;

	console.log("rotateX:    " + rotateX);
	console.log("rotateY:    " + rotateY);
	console.log("rotateVX:    " + rotateVX);
	console.log("rotateVY:    " + rotateVY);

	rotateVX *= 0.98;
	rotateVY *= 0.98;

	if(dragging || rotateTargetX !== undefined ){
		rotateVX *= 0.6;
		rotateVY *= 0.6;
	}

	rotateY += controllers.spin * 0.01;

	//	constrain the pivot up/down to the poles
	//	force a bit of bounce back action when hitting the poles
	if(rotateX < -rotateXMax){
		rotateX = -rotateXMax;
		rotateVX *= -0.95;
	}
	if(rotateX > rotateXMax){
		rotateX = rotateXMax;
		rotateVX *= -0.95;
	}

	TWEEN.update();

	rotating.rotation.x = rotateX;
	rotating.rotation.y = rotateY;

    render();
    		        		       
    requestAnimationFrame( animate );	

    // 场景对象工具集
	THREE.SceneUtils.traverseHierarchy( rotating, 
		// 这里有一个bug需要修复 （Uncaught TypeError: Cannot read property 'children' of undefined）
		function(mesh) {
			if(mesh.id && mesh.id == "36" && attackData.length>0 ) {
				var startpoint = attackData.pop();
				loadGeoData( startpoint );

				startpoint.pointlist = connectionTwoPoint( startpoint, attackTarget);	

				var lineColors = [];
				var lineColor = new THREE.Color( 0xe6be14 );
				var lineColorend = new THREE.Color( 0xff0000 );

				//	grab the colors from the vertices
				var geopoints = startpoint.pointlist.slice(0, 5);
				var pointstart = 0, pointlen = 5;
				for( s in geopoints ){
					if(Number(s)==geopoints.length-1) {
						lineColors.push(lineColorend);
					} else {
						lineColors.push(lineColor);
					}
				}

				var curveGeometry = THREE.Curve.Utils.createLineGeometry( geopoints );
				curveGeometry.colors = lineColors;

				var splineOutline = new THREE.Line( curveGeometry, lineMaterial);
				splineOutline.pointlist = startpoint.pointlist;
				splineOutline.pointstart = pointstart;
				splineOutline.pointlen = pointlen;

				splineOutline.renderDepth = false;
				splineOutline.update = function() {
					var timetipnow = new Date().getTime();

					if(!this.timetip) {
						this.timetip = timetipnow;
					} else if(timetipnow - this.timetip > 3*1000/60) {
						this.timetip = timetipnow;
						if(this.pointstart < this.pointlist.length) {
							this.pointstart += 1;
							this.geometry.vertices = this.pointlist.slice(this.pointstart, this.pointstart + this.pointlen);
							this.geometry.verticesNeedUpdate = true;
						} else {
							this.parent.remove(this);
						}
					}
				}

				mesh.add(splineOutline);
			}

			if (mesh && mesh.update !== undefined) {
				mesh.update();
			}
		}
	);

	for( var i in markers ){
		var marker = markers[i];
		marker.update();
	}		    	

}

function render() {	
	renderer.clear();		    					
    renderer.render( scene, camera );				
}		   

function findCode(countryName){
	countryName = countryName.toUpperCase();
	for( var i in countryLookup ){
		if( countryLookup[i] === countryName )
			return i;
	}
	return 'not found';
}

//	ordered lookup list for country color index
//	used for GLSL to find which country needs to be highlighted
var countryColorMap = {'PE':1,
'BF':2,'FR':3,'LY':4,'BY':5,'PK':6,'ID':7,'YE':8,'MG':9,'BO':10,'CI':11,'DZ':12,'CH':13,'CM':14,'MK':15,'BW':16,'UA':17,
'KE':18,'TW':19,'JO':20,'MX':21,'AE':22,'BZ':23,'BR':24,'SL':25,'ML':26,'CD':27,'IT':28,'SO':29,'AF':30,'BD':31,'DO':32,'GW':33,
'GH':34,'AT':35,'SE':36,'TR':37,'UG':38,'MZ':39,'JP':40,'NZ':41,'CU':42,'VE':43,'PT':44,'CO':45,'MR':46,'AO':47,'DE':48,'SD':49,
'TH':50,'AU':51,'PG':52,'IQ':53,'HR':54,'GL':55,'NE':56,'DK':57,'LV':58,'RO':59,'ZM':60,'IR':61,'MM':62,'ET':63,'GT':64,'SR':65,
'EH':66,'CZ':67,'TD':68,'AL':69,'FI':70,'SY':71,'KG':72,'SB':73,'OM':74,'PA':75,'AR':76,'GB':77,'CR':78,'PY':79,'GN':80,'IE':81,
'NG':82,'TN':83,'PL':84,'NA':85,'ZA':86,'EG':87,'TZ':88,'GE':89,'SA':90,'VN':91,'RU':92,'HT':93,'BA':94,'IN':95,'CN':96,'CA':97,
'SV':98,'GY':99,'BE':100,'GQ':101,'LS':102,'BG':103,'BI':104,'DJ':105,'AZ':106,'MY':107,'PH':108,'UY':109,'CG':110,'RS':111,'ME':112,'EE':113,
'RW':114,'AM':115,'SN':116,'TG':117,'ES':118,'GA':119,'HU':120,'MW':121,'TJ':122,'KH':123,'KR':124,'HN':125,'IS':126,'NI':127,'CL':128,'MA':129,
'LR':130,'NL':131,'CF':132,'SK':133,'LT':134,'ZW':135,'LK':136,'IL':137,'LA':138,'KP':139,'GR':140,'TM':141,'EC':142,'BJ':143,'SI':144,'NO':145,
'MD':146,'LB':147,'NP':148,'ER':149,'US':150,'KZ':151,'AQ':152,'SZ':153,'UZ':154,'MN':155,'BT':156,'NC':157,'FJ':158,'KW':159,'TL':160,'BS':161,
'VU':162,'FK':163,'GM':164,'QA':165,'JM':166,'CY':167,'PR':168,'PS':169,'BN':170,'TT':171,'CV':172,'PF':173,'WS':174,'LU':175,'KM':176,'MU':177,
'FO':178,'ST':179,'AN':180,'DM':181,'TO':182,'KI':183,'FM':184,'BH':185,'AD':186,'MP':187,'PW':188,'SC':189,'AG':190,'BB':191,'TC':192,'VC':193,
'LC':194,'YT':195,'VI':196,'GD':197,'MT':198,'MV':199,'KY':200,'KN':201,'MS':202,'BL':203,'NU':204,'PM':205,'CK':206,'WF':207,'AS':208,'MH':209,
'AW':210,'LI':211,'VG':212,'SH':213,'JE':214,'AI':215,'MF_1_':216,'GG':217,'SM':218,'BM':219,'TV':220,'NR':221,'GI':222,'PN':223,'MC':224,'VA':225,
'IM':226,'GU':227,'SG':228};

function highlightCountry(){
	var countryCodes = [];
	for( var code in countryLookup ){
		countryCodes.push(code);
	}

	var ctx = lookupCanvas.getContext('2d');	
	//ctx.clearRect(0,0,256,1);

	//	color index 0 is the ocean, leave it something neutral
	
	//	this fixes a bug where the fill for ocean was being applied during pick
	//	all non-countries were being pointed to 10 - bolivia
	//	the fact that it didn't select was because bolivia shows up as an invalid country due to country name mismatch
	//	...
	ctx.fillStyle = '#00f';
	ctx.fillRect( 0, 0, 1, 1 );
	
	for( var i in countryCodes ){
		var countryCode = countryCodes[i];
		var colorIndex = countryColorMap[ countryCode ];

		// var fillCSS = '#ff0000';
		// var fillCSS = '#333333';
		var fillCSS = 'rgb(' + colorIndex + ',' + 0 + ',' + 0 + ')';
		if( countryCode === "CN" || countryCode === "TW" )
			fillCSS = '#fff';

		ctx.fillStyle = fillCSS;
		ctx.fillRect( colorIndex, 0, 1, 1 );
	}
	
	lookupTexture.needsUpdate = true;
}

function getHistoricalData( country ){
	var history = [];

	var countryName = country.countryName;

	var exportCategories = selectionData.getExportCategories();
	var importCategories = selectionData.getImportCategories();

	for( var i in timeBins ){
		var yearBin = timeBins[i].data;
		var value = {imports: 0, exports:0};
		for( var s in yearBin ){
			var set = yearBin[s];
			var categoryName = reverseWeaponLookup[set.wc];

			var exporterCountryName = set.e.toUpperCase();
			var importerCountryName = set.i.toUpperCase();
			var relevantCategory = ( countryName == exporterCountryName && $.inArray(categoryName, exportCategories ) >= 0 ) || 
								   ( countryName == importerCountryName && $.inArray(categoryName, importCategories ) >= 0 );

			if( relevantCategory == false )
				continue;

			//	ignore all unidentified country data
			if( countryData[exporterCountryName] === undefined || countryData[importerCountryName] === undefined )
				continue;
			
			if( exporterCountryName == countryName )
				value.exports += set.v;
			if( importerCountryName == countryName )
				value.imports += set.v;
		}
		history.push(value);
	}
	// console.log(history);
	return history;
}

function getPickColor(){
	var affectedCountries = undefined;
	if( visualizationMesh.children[0] !== undefined )
		affectedCountries = visualizationMesh.children[0].affectedCountries;

	highlightCountry([]);
	rotating.remove(visualizationMesh);
	mapUniforms['outlineLevel'].value = 0;
	lookupTexture.needsUpdate = true;

	renderer.autoClear = false;
	renderer.autoClearColor = false;
	renderer.autoClearDepth = false;
	renderer.autoClearStencil = false;	
	renderer.preserve

    renderer.clear();
    renderer.render(scene,camera);

    var gl = renderer.context;
    gl.preserveDrawingBuffer = true;

	var mx = ( mouseX + renderer.context.canvas.width/2 );//(mouseX + renderer.context.canvas.width/2) * 0.25;
	var my = ( -mouseY + renderer.context.canvas.height/2 );//(-mouseY + renderer.context.canvas.height/2) * 0.25;
	mx = Math.floor( mx );
	my = Math.floor( my );

	var buf = new Uint8Array( 4 );		    	
	// console.log(buf);
	gl.readPixels( mx, my, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf );
	// console.log(buf);		

	renderer.autoClear = true;
	renderer.autoClearColor = true;
	renderer.autoClearDepth = true;
	renderer.autoClearStencil = true;

	gl.preserveDrawingBuffer = false;	

	mapUniforms['outlineLevel'].value = 1;
	rotating.add(visualizationMesh);


	if( affectedCountries !== undefined ){
		highlightCountry(affectedCountries);
	}
	return buf[0]; 	
}


<!-- dataloading.js -->

var loadWorldPins = function( callback ){							
	// We're going to ask a file for the JSON data.
	xhr = new XMLHttpRequest();

	// Where do we get the data?
	xhr.open( 'GET', latlonFile, true );

	// What do we do when we have it?
	xhr.onreadystatechange = function() {
	  // If we've received the data
	  if ( xhr.readyState === 4 && xhr.status === 200 ) {
	      // Parse the JSON
	      latlonData = JSON.parse( xhr.responseText );
	      console.log("latlonData::::");
	      console.log(latlonData);
	      if( callback )
	      	callback();				     
	    }
	};

	// Begin request
	xhr.send( null );			    	
}

var getAttackData = function(){	
	var end_tip = String(new Date().getTime()).substr(0, 10);
	var end_ts = Number(end_tip) - 60*60;
	var start_ts = end_ts - 5;
	$.getJSON("http://192.168.79.158:8080/event_get?category=attack&start_ts=" + start_ts + "&end_ts=" + end_ts + "&callback=?",
        function(data){
	        console.log("getAttackData:");
	        console.log(data);
        	if(data['rc']) {
        		var result = data['results'];
        		// attackData.concat(result);
        		$.each(result, function (i, item) {
			        // $body.queue('mx', function () {
			        	item.lat = item.latitude;
			        	item.lon = item.longitude;
		                attackData.push(item);
		            // })
		        });
        	}
        });					    	
}

setInterval(getAttackData, 5000);

var loadAttackData = function(callback){	
	var filePath = "data/attackdata.json";
	filePath = encodeURI( filePath );
	// console.log(filePath);
			
	xhr = new XMLHttpRequest();
	xhr.open( 'GET', filePath, true );
	xhr.onreadystatechange = function() {
		if ( xhr.readyState === 4 && xhr.status === 200 ) {
			console.log("load attackdata.json::::");
			// console.log(xhr.responseText);
	    	attackData = JSON.parse( xhr.responseText ).attackdata;

	    	for(var d in attackData) {
	    		attackData[d].lon = attackData[d].w_longitude;
	    		attackData[d].lat = attackData[d].w_latitude;
	    	}

			if(callback)
				callback();
	    	console.log("finished read data file");	   	
	    }
	};
	xhr.send( null );					    	
}

var loadCountryCodes = function( callback ){
	cxhr = new XMLHttpRequest();
	cxhr.open( 'GET', isoFile, true );
	cxhr.onreadystatechange = function() {
		if ( cxhr.readyState === 4 && cxhr.status === 200 ) {
	    	countryLookup = JSON.parse( cxhr.responseText );	
	    	console.log("countryLookup::::");
	    	console.log(countryLookup);
	    	console.log("loaded country codes");
	    	callback();
	    }
	};
	cxhr.send( null );
}

<!-- geopins.js -->

				

//	convenience function to get the country object by name
var getCountry = function(name){
	return countryData[name.toUpperCase()]
}


<!-- visualize.js -->
var buildDataVizGeometries = function( linearData ){	

	var loadLayer = document.getElementById('loading');

	for( var i in linearData ){
		var yearBin = linearData[i].data;		

		var year = linearData[i].t;
		selectableYears.push(year);	

		var count = 0;
		console.log('Building data for ...' + year);
		for( var s in yearBin ){
			var set = yearBin[s];

			var exporterName = set.e.toUpperCase();
			var importerName = set.i.toUpperCase();

			exporter = countryData[exporterName];
			importer = countryData[importerName];	
			
			//	we couldn't find the country, it wasn't in our list...
			if( exporter === undefined || importer === undefined )
				continue;			

			//	visualize this event
			set.lineGeometry = makeConnectionLineGeometry( exporter, importer, set.v, set.wc );		

			// if( s % 1000 == 0 )
			// 	console.log( 'calculating ' + s + ' of ' + yearBin.length + ' in year ' + year);
		}

		//	use this break to only visualize one year (1992)
		// break;

		//	how to make this work?
		// loadLayer.innerHTML = 'loading data for ' + year + '...';
		// console.log(loadLayer.innerHTML);
	}			

	loadLayer.style.display = 'none';	
}



var constrain = function(v, min, max){
	if( v < min )
		v = min;
	else
	if( v > max )
		v = max;
	return v;
}



<!-- datguicontrol.js -->

var controllers = {
	speed: 			3,							
	multiplier: 	0.5,
	backgroundColor:"#000000",
	zoom: 			1,
	spin: 			0,
	transitionTime: 2000,
};	

var buildGUI = function(){	
	var selection = new Selection();
	selectionData = selection;
}


<!-- ui.controls.js -->

/**
ui.control.js
Created by Pitch Interactive
Created on 6/26/2012
This code will control the primary functions of the UI in the ArmsGlobe app
**/
d3.selection.prototype.moveToFront = function() { 
    return this.each(function() { 
        this.parentNode.appendChild(this); 
    }); 
}; 

var d3Graphs = {
    barGraphWidth: 300,
	barGraphHeight: 800,
    barWidth: 14,
	barGraphTopPadding: 20,
	barGraphBottomPadding: 50,
	histogramWidth: 686,
	histogramHeight: 160,
	histogramLeftPadding:31,
	histogramRightPadding: 31,
	histogramVertPadding:20,
	barGraphSVG: d3.select("#wrapper").append("svg").attr('id','barGraph'),
	histogramSVG: null,
	histogramYScale: null,
	histogramXScale: null,
	cumImportY: 0,cumExportY: 0,
    cumImportLblY: 0,cumExportLblY: 0,
    inited: false,
    histogramOpen: false,
    handleLeftOffset: 12,
    handleInterval: 35,
    windowResizeTimeout: -1,
    histogramImports: null,
    histogramExports: null,
    histogramAbsMax: 0,
    previousImportLabelTranslateY: -1,
    previousExportLabelTranslateY: -1,
    zoomBtnInterval: -1,


    setCountry: function(country) {
        $("#hudButtons .countryTextInput").val(country);
        d3Graphs.updateViz();
    },
    initGraphs: function() {
        this.showHud();
        this.drawBarGraph();
        this.drawHistogram();
    },
    showHud: function() {
        if(this.inited) return;
        this.inited = true;
        d3Graphs.windowResize();
        $("#hudHeader, #hudButtons").show();
        $("#history").show();
        $("#graphIcon").show();
        $("#importExportBtns").show();
        $("#graphIcon").click(d3Graphs.graphIconClick);
        $("#history .close").click(d3Graphs.closeHistogram);
        $("#history ul li").click(d3Graphs.clickTimeline);
        $("#handle").draggable({axis: 'x',containment: "parent",grid:[this.handleInterval, this.handleInterval],  stop: d3Graphs.dropHandle, drag: d3Graphs.dropHandle });
        $("#hudButtons .searchBtn").click(d3Graphs.updateViz);
        $("#importExportBtns .imex>div").not(".label").click(d3Graphs.importExportBtnClick);
        $("#importExportBtns .imex .label").click(d3Graphs.importExportLabelClick);
        $("#hudButtons .countryTextInput").autocomplete({ source:selectableCountries, autoFocus: true });
        $("#hudButtons .countryTextInput").keyup(d3Graphs.countryKeyUp);
        $("#hudButtons .countryTextInput").focus(d3Graphs.countryFocus);
        $("#hudButtons .aboutBtn").click(d3Graphs.toggleAboutBox);
        $(document).on("click",".ui-autocomplete li",d3Graphs.menuItemClick);
        $(window).resize(d3Graphs.windowResizeCB);
        $(".zoomBtn").mousedown(d3Graphs.zoomBtnClick);
        $(".zoomBtn").mouseup(d3Graphs.zoomBtnMouseup);
        
    },
    zoomBtnMouseup: function() {
        clearInterval(d3Graphs.zoomBtnInterval);
    },
    zoomBtnClick:function() {
        var delta;
        if($(this).hasClass('zoomOutBtn')) {
            delta = -0.5;
        } else {
            delta = 0.5;
        }
        d3Graphs.doZoom(delta);
        d3Graphs.zoomBtnInterval = setInterval(d3Graphs.doZoom,50,delta);
    },
    doZoom:function(delta) {
        camera.scale.z += delta * 0.1;
        camera.scale.z = constrain( camera.scale.z, 0.8, 5.0 );
    },
    toggleAboutBox:function() {
        $("#aboutContainer").toggle();
    },
    clickTimeline:function() {
        var year = $(this).html();
        if(year < 10) {
            year = (year * 1) + 2000;
        }
        if(year < 100) {
            year = (year * 1) + 1900
        }
        var index = year - 1992;
        var leftPos = d3Graphs.handleLeftOffset + d3Graphs.handleInterval * index;
        $("#handle").css('left',leftPos+"px");
        d3Graphs.updateViz();
    },
    windowResizeCB:function() {
        clearTimeout(d3Graphs.windowResizeTimeout);
        d3Graphs.windowResizeTimeout = setTimeout(d3Graphs.windowResize, 50);
    },
    windowResize: function() {
        var windowWidth = $(window).width();
        var windowHeight = $(window).height();
        d3Graphs.positionHistory(windowWidth);
        var minWidth = 1280;
        var minHeight = 860;
        var w = windowWidth < minWidth ? minWidth : windowWidth;
        var hudButtonWidth = 489;
        $('#hudButtons').css('left',w - hudButtonWidth-20);        
        var importExportButtonWidth = $("#importExportBtns").width();
        $("#importExportBtns").css('left',w-importExportButtonWidth - 20);
        var barGraphHeight = 800;
        var barGraphBottomPadding = 10;
        console.log(windowHeight+ " " + barGraphHeight + " " + barGraphBottomPadding);
        var barGraphTopPos = (windowHeight < minHeight ? minHeight : windowHeight) - barGraphHeight - barGraphBottomPadding;
        console.log(barGraphTopPos);
        
        $("#barGraph").css('top',barGraphTopPos+'px');
        /*
        var hudHeaderLeft = $("#hudHeader").css('left');
        hudHeaderLeft = hudHeaderLeft.substr(0,hudHeaderLeft.length-2)
        console.log(hudHeaderLeft);
        var hudPaddingRight = 30;
        $("#hudHeader").width(w-hudHeaderLeft - hudPaddingRight);
        */
    },
    positionHistory: function(windowWidth) {
        var graphIconPadding = 20;
        var historyWidth = $("#history").width();
        var totalWidth = historyWidth + $("#graphIcon").width() + graphIconPadding;
//        var windowWidth = $(window).width();
        var historyLeftPos = (windowWidth - totalWidth) / 2.0;
        var minLeftPos = 280;
        if(historyLeftPos < minLeftPos) {
            historyLeftPos = minLeftPos;
        }
        $("#history").css('left',historyLeftPos+"px");
        $("#graphIcon").css('left',historyLeftPos + historyWidth + graphIconPadding+'px');
    },
    countryFocus:function(event) {
        //console.log("focus");
        setTimeout(function() { $('#hudButtons .countryTextInput').select() },50);
    },
    menuItemClick:function(event) {
        d3Graphs.updateViz();
    },
    countryKeyUp: function(event) {
        if(event.keyCode == 13 /*ENTER */) {
            d3Graphs.updateViz();
        }
    },
    
    updateViz:function() {
        var yearOffset = $("#handle").css('left');
        yearOffset = yearOffset.substr(0,yearOffset.length-2);
        yearOffset -= d3Graphs.handleLeftOffset;
        yearOffset /= d3Graphs.handleInterval;
        var year = yearOffset + 1992;
        
        var country = $("#hudButtons .countryTextInput").val().toUpperCase();
        if(typeof countryData[country] == 'undefined') {
            return;
        }
        
        //exports first
        var exportArray = []
        var exportBtns = $("#importExportBtns .exports>div").not(".label");
        for(var i = 0; i < exportBtns.length; i++) {
            var btn = $(exportBtns[i]);
            var weaponTypeKey = btn.attr('class');
            var weaponName = reverseWeaponLookup[weaponTypeKey];

            if(btn.find('.inactive').length == 0) {
                exportArray.push(weaponName);
                selectionData.exportCategories[weaponName] = true;
            } else {
                selectionData.exportCategories[weaponName] = false;
            }
        }
        //imports esecond
        var importArray = []
        var importBtns = $("#importExportBtns .imports>div").not(".label");
        for(var i = 0; i < importBtns.length; i++) {
            var btn = $(importBtns[i]);
            var weaponTypeKey = btn.attr('class');
            var weaponName = reverseWeaponLookup[weaponTypeKey];
            if(btn.find('.inactive').length == 0) {
                importArray.push(weaponName);
                selectionData.importCategories[weaponName] = true;
            } else {
                selectionData.importCategories[weaponName] = false;
            }
        }
        selectionData.selectedYear = year;
        selectionData.selectedCountry = country;
        selectVisualization(timeBins, year,[country],exportArray, importArray);
    },
    dropHandle:function() {
        d3Graphs.updateViz();
    },
    importExportLabelClick: function() {
        var btns = $(this).prevAll();
        var numInactive = 0;
        for(var i = 0; i < btns.length; i++) {
            if($(btns[i]).find('.inactive').length > 0) {
                numInactive++;
            }
        }
        if(numInactive <= 1) {
            //add inactive
            $(btns).find('.check').addClass('inactive');
        } else {
            //remove inactive
            $(btns).find('.check').removeClass('inactive');
        }
        d3Graphs.updateViz();
    },
    importExportBtnClick:function() { 
        var check = $(this).find('.check');
        if(check.hasClass('inactive')) {
            check.removeClass('inactive');
        } else {
            check.addClass('inactive');
        }
        d3Graphs.updateViz();
    },
    graphIconClick: function() {
        if(!d3Graphs.histogramOpen) {
            d3Graphs.histogramOpen = true;
            $("#history .graph").slideDown();
        } else {
            d3Graphs.closeHistogram();
        }
    },
    closeHistogram: function() {
        d3Graphs.histogramOpen = false;
        $("#history .graph").slideUp();
    },
    line: d3.svg.line()
        // assign the X function to plot our line as we wish
    .x(function(d,i) { 
        if(d == null) {
            return null;
        }
        return d3Graphs.histogramXScale(d.x) + d3Graphs.histogramLeftPadding; 
     })
    .y(function(d) { 
        if(d == null) {
            return null;
        }
        return d3Graphs.histogramYScale(d.y) + d3Graphs.histogramVertPadding; 
    }),
    setHistogramData:function() {
        var importArray = [];
        var exportArray = [];
        var historical = selectedCountry.summary.historical;
        var numHistory = historical.length;
        var absMax = 0;
        var startingImportIndex = 0;
        var startingExportIndex = 0;
        
        while(startingImportIndex < historical.length && historical[startingImportIndex].imports == 0) {
            startingImportIndex++;
        }
        while(startingExportIndex < historical.length && historical[startingExportIndex].exports == 0) {
            startingExportIndex++;
        }
        for(var i = 0; i < startingImportIndex; i++) {
//            importArray.push({x:i, y:null});
        }
        if(startingImportIndex != numHistory) {
            importArray.push({x: startingImportIndex, y:0});
        }
        for(var i = startingImportIndex + 1; i < numHistory; i++) {
            var importPrev = historical[startingImportIndex].imports;
            var importCur = historical[i].imports;
            var importDiff = (importCur - importPrev) / importPrev * 100;
            importArray.push({x:i, y:importDiff});
            if(Math.abs(importDiff) > absMax) {
                absMax = Math.abs(importDiff);
            }
            
        }
        for(var i = 0; i < startingExportIndex; i++) {
        //    exportArray.push(null);
        }
        if(startingExportIndex != numHistory) {
            exportArray.push({x: startingExportIndex, y: 0});
        }
        for(var i = startingExportIndex + 1; i < numHistory; i++) {    
            var exportPrev = historical[startingExportIndex].exports;
            var exportCur = historical[i].exports;
            var exportDiff = (exportCur - exportPrev) / exportPrev * 100;
            exportArray.push({x: i, y: exportDiff}); 
            if(Math.abs(exportDiff) > absMax) {
                absMax = Math.abs(exportDiff);
            }
            
        }
        this.histogramImportArray = importArray;
        this.histogramExportArray = exportArray;
        this.histogramAbsMax = absMax;
    },
    drawHistogram:function() {
        if(this.histogramSVG == null) {
            this.histogramSVG = d3.select('#history .container').append('svg');
            this.histogramSVG.attr('id','histogram').attr('width',this.histogramWidth).attr('height',this.histogramHeight);
        }
        this.setHistogramData();
        
        this.histogramYScale = d3.scale.linear().domain([this.histogramAbsMax,-this.histogramAbsMax]).range([0, this.histogramHeight - this.histogramVertPadding*2]);
        var maxX = selectedCountry.summary.historical.length - 1;
        this.histogramXScale = d3.scale.linear().domain([0,maxX]).range([0, this.histogramWidth - this.histogramLeftPadding - this.histogramRightPadding]);
        
        var tickData = this.histogramYScale.ticks(4);
        var containsZero = false;
        var numTicks = tickData.length;
        for(var i = 0; i < numTicks; i++) {
            if(tickData[i] == 0) {
                containsZero = true;
                break;
            }
        }
        if(!containsZero && numTicks != 0) {
            tickData.push(0);
        }
        //tick lines
        var ticks = this.histogramSVG.selectAll('line.tick').data(tickData);
        ticks.enter().append('svg:line').attr('class','tick');
        ticks.attr('y1',function(d) {
            return d3Graphs.histogramYScale(d) + d3Graphs.histogramVertPadding;
        }).attr('y2', function(d) {
            return d3Graphs.histogramYScale(d) + d3Graphs.histogramVertPadding;
        }).attr('x1',this.histogramLeftPadding).attr('x2',this.histogramWidth - this.histogramRightPadding)
        .attr('stroke-dasharray',function(d) {
            if(d == 0) {
              return null;
            }
            return '3,1';
        }).attr('stroke-width',function(d) {
            if(d == 0) {
                return 2;
            }
            return 1;
        });
        //tick labels
        var tickLabels = this.histogramSVG.selectAll("text.tickLblLeft").data(tickData);
        tickLabels.enter().append('svg:text').attr('class','tickLbl tickLblLeft').attr('text-anchor','end');
        tickLabels.attr('x', d3Graphs.histogramLeftPadding-3).attr('y',function(d) {
            return d3Graphs.histogramYScale(d) + d3Graphs.histogramVertPadding + 4;
        }).text(function(d) { return Math.abs(d); }).attr('display', function(d) {
            if(d == 0) { return 'none'; }
            return null;
        });
        var tickLabelsRight = this.histogramSVG.selectAll("text.tickLblRight").data(tickData);
        tickLabelsRight.enter().append('svg:text').attr('class','tickLbl tickLblRight');
        tickLabelsRight.attr('x', d3Graphs.histogramWidth - d3Graphs.histogramRightPadding+3).attr('y',function(d) {
            return d3Graphs.histogramYScale(d) + d3Graphs.histogramVertPadding + 4;
        }).text(function(d) { return Math.abs(d); }).attr('display', function(d) {
            if(d == 0) { return 'none'; }
            return null;
        });
        ticks.exit().remove();
        tickLabels.exit().remove();
        tickLabelsRight.exit().remove();
        //+ and -
        var plusMinus = this.histogramSVG.selectAll("text.plusMinus").data(["+","—","+","—"]); //those are &mdash;s
        plusMinus.enter().append('svg:text').attr('class','plusMinus').attr('text-anchor',function(d,i) {
            if(i < 2) return 'end';
            return null;
        }).attr('x',function(d,i) {
            var plusOffset = 3;
            if(i < 2) return d3Graphs.histogramLeftPadding + (d == '+' ? -plusOffset : 0) -2;
            return d3Graphs.histogramWidth - d3Graphs.histogramRightPadding + (d == '+' ? plusOffset : 0)+2;
        }).attr('y',function(d,i) {
            var yOffset = 10;
            return d3Graphs.histogramYScale(0) + d3Graphs.histogramVertPadding +  6 + (d == '+' ? -yOffset : yOffset); 
        }).text(String);
        //lines
        var importsVisible = $("#importExportBtns .imports .check").not(".inactive").length != 0;
        var exportsVisible = $("#importExportBtns .exports .check").not(".inactive").length != 0;
        $("#history .labels .exports").css('display', exportsVisible ? 'block' : 'none');
        $("#history .labels .imports").css('display', importsVisible ? 'block' : 'none');
        
    
        var importLine = this.histogramSVG.selectAll("path.import").data([1]);
        importLine.enter().append('svg:path').attr('class','import');
        importLine.attr('d',
        function(){
            if(d3Graphs.histogramImportArray.length == 0) {
                return 'M 0 0';
            } else {
                return d3Graphs.line(d3Graphs.histogramImportArray);
            }
        }).attr('visibility',importsVisible ? 'visible' : 'hidden');
        var exportLine = this.histogramSVG.selectAll("path.export").data([1]);
        exportLine.enter().append('svg:path').attr('class','export');
        exportLine.attr('d',function() {
            if(d3Graphs.histogramExportArray.length == 0) {
                return 'M 0 0';
            } else {
                return d3Graphs.line(d3Graphs.histogramExportArray);
            }
        }).attr('visibility', exportsVisible ? 'visible' : 'hidden');
        importLine.moveToFront();
        exportLine.moveToFront();
        //active year labels
        var yearOffset = $("#handle").css('left');
        yearOffset = yearOffset.substr(0,yearOffset.length-2);
        yearOffset -= d3Graphs.handleLeftOffset;
        yearOffset /= d3Graphs.handleInterval;
        var activeYearImports = null;
        for(var i = 0; i < this.histogramImportArray.length; i++) {
            var curYearData = this.histogramImportArray[i];
            if(curYearData.x == yearOffset) {
                activeYearImports = curYearData;
                break;
            }
        }
        var activeYearExports = null;
        for(var i = 0; i < this.histogramExportArray.length; i++) {
            var curYearData = this.histogramExportArray[i];
            if(curYearData.x == yearOffset) {
                activeYearExports = curYearData;
                break;
            }
        }
        var maxVal;
        if(activeYearImports != null && activeYearExports!= null) {
            maxVal = activeYearImports.y > activeYearExports.y ? activeYearImports.y : activeYearExports.y;
        } else if(activeYearImports != null) {
            maxVal = activeYearImports.y;
        } else if(activeYearExports != null) {
            maxVal = activeYearExports.y;
        } else {
            maxVal = -1;
        }

        var activeYearData = [{x:yearOffset, y: activeYearImports != null ? activeYearImports.y : -1, max: maxVal, show: activeYearImports!=null, type:"imports"},
            {x: yearOffset, y: activeYearExports != null ? activeYearExports.y : -1, max: maxVal, show:activeYearExports!=null, type:'exports'}];
        var yearDots = this.histogramSVG.selectAll("ellipse.year").data(activeYearData);
        var yearDotLabels = this.histogramSVG.selectAll("text.yearLabel").data(activeYearData);
        yearDots.enter().append('ellipse').attr('class','year').attr('rx',4).attr('ry',4)
            .attr('cx',function(d) { return d3Graphs.histogramLeftPadding + d3Graphs.histogramXScale(d.x); })
            .attr('cy',function(d) { return d3Graphs.histogramVertPadding + d3Graphs.histogramYScale(d.y); });
        yearDotLabels.enter().append('text').attr('class','yearLabel').attr('text-anchor','middle');
        var importsVisible = $("#importExportBtns .imports .check").not(".inactive").length != 0;
        var exportsVisible = $("#importExportBtns .exports .check").not(".inactive").length != 0;
        
        yearDots.attr('cx', function(d) { return d3Graphs.histogramLeftPadding + d3Graphs.histogramXScale(d.x); })
            .attr('cy',function(d) { return d3Graphs.histogramVertPadding + d3Graphs.histogramYScale(d.y); } )
            .attr('visibility', function(d) {
                if(d.show == false) {
                    return 'hidden';
                }
                if(d.type == "imports") {
                    return importsVisible ? 'visible' : 'hidden';
                } else if(d.type == "exports") {
                    return exportsVisible ? 'visible' : 'hidden';
                }
            });
        yearDotLabels.attr('x',function(d) { return d3Graphs.histogramLeftPadding + d3Graphs.histogramXScale(d.x); })
        .attr('y',function(d) {
            var yVal = d3Graphs.histogramYScale(d.y) + d3Graphs.histogramVertPadding;
            if(d.y == maxVal) {
                yVal -= 7;  
            } else {
                yVal += 19;
            }
            if(yVal > d3Graphs.histogramHeight + d3Graphs.histogramVertPadding) {
                yVal -= 26;
            }
            return yVal;
            
        }).text(function(d) {
            var numlbl = Math.round(d.y*10)/10;
            var lbl = "";
            if(d.y > 0) {
                lbl = "+";
            }
            lbl += ""+numlbl+"%";
            return lbl;

        }).attr('visibility', function(d) {
            if(d.show == false) {
                return 'hidden';
            }
            if(d.type == "imports") {
                return importsVisible ? 'visible' : 'hidden';
            } else if(d.type == "exports") {
                return exportsVisible ? 'visible' : 'hidden';
            }
        });
        yearDots.moveToFront();
        yearDotLabels.moveToFront();

    },
    drawBarGraph: function() {
        this.barGraphSVG.attr('id','barGraph').attr('width',d3Graphs.barGraphWidth).attr('height',d3Graphs.barGraphHeight).attr('class','overlayCountries noPointer');
        var importArray = [];
        var exportArray = [];
        var importTotal = selectedCountry.summary.imported.total;
        var exportTotal = selectedCountry.summary.exported.total;
        var minImExAmount = Number.MAX_VALUE;
        var maxImExAmount = Number.MIN_VALUE;
        for(var type in reverseWeaponLookup) {
            var imAmnt = selectedCountry.summary.imported[type];
            var exAmnt = selectedCountry.summary.exported[type];
            if(imAmnt < minImExAmount) {
                minImExAmount = imAmnt;
            }
            if(imAmnt > maxImExAmount) {
                maxImExAmount = imAmnt;
            }
            if(exAmnt < minImExAmount) {
                minImExAmount = exAmnt;
            }
            if(exAmnt > maxImExAmount) {
                maxImExAmount = exAmnt;
            }
            importArray.push({"type":type, "amount": imAmnt});
            exportArray.push({"type":type, "amount": exAmnt});
        }
        var max = importTotal > exportTotal ? importTotal : exportTotal;
        var yScale = d3.scale.linear().domain([0,max]).range([0,this.barGraphHeight - this.barGraphBottomPadding - this.barGraphTopPadding]);
        var importRects = this.barGraphSVG.selectAll("rect.import").data(importArray);
        var midX = this.barGraphWidth / 2;
        this.cumImportY = this.cumExportY = 0;
        importRects.enter().append('rect').attr('class', function(d) {
            return 'import '+d.type;
        }).attr('x',midX - this.barWidth).attr('width',this.barWidth);
        
        importRects.attr('y',function(d) {
            var value = d3Graphs.barGraphHeight - d3Graphs.barGraphBottomPadding - d3Graphs.cumImportY - yScale(d.amount) ;
            d3Graphs.cumImportY += yScale(d.amount);
            return value;
        }).attr('height',function(d) { return yScale(d.amount); });
        var exportRects = this.barGraphSVG.selectAll('rect.export').data(exportArray);
        exportRects.enter().append('rect').attr('class',function(d) {
            return 'export '+ d.type;
        }).attr('x',midX + 10).attr('width',this.barWidth);
        
        exportRects.attr('y',function(d) {
            var value = d3Graphs.barGraphHeight - d3Graphs.barGraphBottomPadding - d3Graphs.cumExportY - yScale(d.amount);
            d3Graphs.cumExportY += yScale(d.amount);
            return value;
        }).attr('height',function(d) { return yScale(d.amount); });
        //bar graph labels
        this.cumImportLblY = 0;
        this.cumExportLblY = 0;
        this.previousImportLabelTranslateY = 0;
        this.previousExportLabelTranslateY = 0;
        var paddingFromBottomOfGraph = 00;
        var heightPerLabel = 25;
        var fontSizeInterpolater = d3.interpolateRound(10,28);
        var smallLabelSize = 22;
        var mediumLabelSize = 40;
        //import labels
        var importLabelBGs = this.barGraphSVG.selectAll("rect.barGraphLabelBG").data(importArray);
        importLabelBGs.enter().append('rect').attr('class',function(d) {
            return 'barGraphLabelBG ' + d.type; });
        var importLabels = this.barGraphSVG.selectAll("g.importLabel").data(importArray);
        importLabels.enter().append("g").attr('class',function(d) {
            return 'importLabel '+d.type;
        });
        importLabels.attr('transform',function(d) { 
            var translate = 'translate('+(d3Graphs.barGraphWidth / 2 - 25)+",";
            var value = d3Graphs.barGraphHeight - d3Graphs.barGraphBottomPadding - d3Graphs.cumImportLblY - yScale(d.amount)/2;
            d3Graphs.cumImportLblY += yScale(d.amount);
            translate += value+")";
            this.previousImportLabelTranslateY = value;
            return translate;
        }).attr('display',function(d) {
            if(d.amount == 0) { return 'none';}
            return null;
        });
        importLabels.selectAll("*").remove();
        var importLabelArray = importLabels[0];
        var importLabelBGArray = importLabelBGs[0];
        for(var i = 0; i < importLabelArray.length; i++) {
            var importLabelE = importLabelArray[i];
            var importLabel = d3.select(importLabelE);
            var data = importArray[i];
            importLabel.data(data);
            var pieceHeight = yScale(data.amount);
            var labelHeight = -1;
            var labelBGYPos = -1;
            var labelWidth = -1;
            var importLabelBG = d3.select(importLabelBGArray[i]);
            if(pieceHeight < smallLabelSize) {
                //just add number
                //console.log("small label");
                var numericLabel = importLabel.append('text').text(function(d) {
                    return abbreviateNumber(d.amount);
                }).attr('text-anchor','end').attr('alignment-baseline','central')
                .attr('font-size',function(d) {
                    return fontSizeInterpolater((d.amount-minImExAmount)/(maxImExAmount - minImExAmount));
                });
                labelHeight = fontSizeInterpolater((data.amount-minImExAmount)/(maxImExAmount-minImExAmount));
                labelBGYPos = - labelHeight / 2;
                var numericLabelEle = numericLabel[0][0];
                labelWidth = numericLabelEle.getComputedTextLength();
            } else if(pieceHeight < mediumLabelSize || data.type == 'ammo') {
                //number and type
                //console.log('medium label');
                var numericLabel = importLabel.append('text').text(function(d) {
                    return abbreviateNumber(d.amount);
                }).attr('text-anchor','end').attr('font-size',function(d) {
                    return fontSizeInterpolater((d.amount-minImExAmount)/(maxImExAmount - minImExAmount));
                });
                var textLabel = importLabel.append('text').text(function(d) {
                    return reverseWeaponLookup[d.type].split(' ')[0].toUpperCase();
                }).attr('text-anchor','end').attr('y',15).attr('class',function(d) { return 'import '+d.type});
                labelHeight = fontSizeInterpolater((data.amount-minImExAmount)/(maxImExAmount-minImExAmount));
                labelBGYPos = -labelHeight;
                labelHeight += 16;
                var numericLabelEle = numericLabel[0][0];
                var textLabelEle = textLabel[0][0];
                labelWidth = numericLabelEle.getComputedTextLength() > textLabelEle.getComputedTextLength() ? numericLabelEle.getComputedTextLength() : textLabelEle.getComputedTextLength();
            } else {
                //number type and 'weapons'
                //console.log('large label');
                var numericLabel = importLabel.append('text').text(function(d) {
                    return abbreviateNumber(d.amount);
                }).attr('text-anchor','end').attr('font-size',function(d) {
                    return fontSizeInterpolater((d.amount-minImExAmount)/(maxImExAmount - minImExAmount));
                }).attr('y',-7);
                var textLabel = importLabel.append('text').text(function(d) {
                    return reverseWeaponLookup[d.type].split(' ')[0].toUpperCase();
                }).attr('text-anchor','end').attr('y',8).attr('class',function(d) { return 'import '+d.type});
                var weaponLabel  =importLabel.append('text').text('WEAPONS').attr('text-anchor','end').attr('y',21)
                    .attr('class',function(d) { return'import '+d.type} );
                labelHeight = fontSizeInterpolater((data.amount-minImExAmount)/(maxImExAmount-minImExAmount));
                labelBGYPos = -labelHeight - 7;
                labelHeight += 16 +14;
                var numericLabelEle = numericLabel[0][0];
                var textLabelEle = textLabel[0][0];
                var weaponLabelEle = weaponLabel[0][0];
                labelWidth = numericLabelEle.getComputedTextLength() > textLabelEle.getComputedTextLength() ? numericLabelEle.getComputedTextLength() : textLabelEle.getComputedTextLength();
                if(weaponLabelEle.getComputedTextLength() > labelWidth) {
                    labelWidth = weaponLabelEle.getComputedTextLength();
                }
            }
            if(labelHeight != -1 && labelBGYPos != -1 && labelWidth != -1) {
                importLabelBG.attr('x',-labelWidth).attr('y',labelBGYPos).attr('width',labelWidth).attr('height',labelHeight)
                    .attr('transform',importLabel.attr('transform'));
            }
        }
        //export labels
        var exportLabelBGs = this.barGraphSVG.selectAll("rect.barGraphLabelBG.exportBG").data(exportArray);
        exportLabelBGs.enter().append('rect').attr('class',function(d) {
            return 'barGraphLabelBG exportBG ' + d.type; });
        var exportLabels = this.barGraphSVG.selectAll("g.exportLabel").data(exportArray);
        exportLabels.enter().append("g").attr('class',function(d) {
            return 'exportLabel '+d.type;
        });
        exportLabels.attr('transform',function(d) { 
            var translate = 'translate('+(d3Graphs.barGraphWidth / 2 + 35)+",";
            var value = d3Graphs.barGraphHeight - d3Graphs.barGraphBottomPadding - d3Graphs.cumExportLblY - yScale(d.amount)/2;
            d3Graphs.cumExportLblY += yScale(d.amount);
            translate += value+")";
            this.previousExportLabelTranslateY = value;
            return translate;
        }).attr('display',function(d) {
            if(d.amount == 0) { return 'none';}
            return null;
        });
        exportLabels.selectAll("*").remove();
        var exportLabelArray = exportLabels[0];
        var exportLabelBGArray = exportLabelBGs[0];
        for(var i = 0; i < exportLabelArray.length; i++) {
            var exportLabelE = exportLabelArray[i];
            var exportLabel = d3.select(exportLabelE);
            var data = exportArray[i];
            exportLabel.data(data);
            var pieceHeight = yScale(data.amount);
            var labelHeight = -1;
            var labelBGYPos = -1;
            var labelWidth = -1;
            var exportLabelBG = d3.select(exportLabelBGArray[i]);
            if(pieceHeight < smallLabelSize) {
                //just add number
                //console.log("small label");
                var numericLabel = exportLabel.append('text').text(function(d) {
                    return abbreviateNumber(d.amount);
                }).attr('text-anchor','start').attr('alignment-baseline','central')
                .attr('font-size',function(d) {
                    return fontSizeInterpolater((d.amount-minImExAmount)/(maxImExAmount - minImExAmount));
                });
                labelHeight = fontSizeInterpolater((data.amount-minImExAmount)/(maxImExAmount-minImExAmount));
                labelBGYPos = - labelHeight / 2;
                var numericLabelEle = numericLabel[0][0];
                labelWidth = numericLabelEle.getComputedTextLength();
            } else if(pieceHeight < mediumLabelSize || data.type == 'ammo') {
                //number and type
                var numericLabel = exportLabel.append('text').text(function(d) {
                    return abbreviateNumber(d.amount);
                }).attr('text-anchor','start').attr('font-size',function(d) {
                    return fontSizeInterpolater((d.amount-minImExAmount)/(maxImExAmount - minImExAmount));
                });
                var textLabel = exportLabel.append('text').text(function(d) {
                    return reverseWeaponLookup[d.type].split(' ')[0].toUpperCase();
                }).attr('text-anchor','start').attr('y',15).attr('class',function(d) { return 'export '+d.type});
                labelHeight = fontSizeInterpolater((data.amount-minImExAmount)/(maxImExAmount-minImExAmount));
                labelBGYPos = -labelHeight;
                labelHeight += 16;
                var numericLabelEle = numericLabel[0][0];
                var textLabelEle = textLabel[0][0];
                labelWidth = numericLabelEle.getComputedTextLength() > textLabelEle.getComputedTextLength() ? numericLabelEle.getComputedTextLength() : textLabelEle.getComputedTextLength();
            } else {
                //number type and 'weapons'
                var numericLabel = exportLabel.append('text').text(function(d) {
                    return abbreviateNumber(d.amount);
                }).attr('text-anchor','start').attr('font-size',function(d) {
                    return fontSizeInterpolater((d.amount-minImExAmount)/(maxImExAmount - minImExAmount));
                }).attr('y',-7);
                var textLabel = exportLabel.append('text').text(function(d) {
                    return reverseWeaponLookup[d.type].split(' ')[0].toUpperCase();
                }).attr('text-anchor','start').attr('y',8).attr('class',function(d) { return 'export '+d.type});
                var weaponLabel  =exportLabel.append('text').text('WEAPONS').attr('text-anchor','start').attr('y',21)
                    .attr('class',function(d) { return'export '+d.type} );
                labelHeight = fontSizeInterpolater((data.amount-minImExAmount)/(maxImExAmount-minImExAmount));
                labelBGYPos = -labelHeight - 7;
                labelHeight += 16 +14;
                var numericLabelEle = numericLabel[0][0];
                var textLabelEle = textLabel[0][0];
                var weaponLabelEle = weaponLabel[0][0];
                labelWidth = numericLabelEle.getComputedTextLength() > textLabelEle.getComputedTextLength() ? numericLabelEle.getComputedTextLength() : textLabelEle.getComputedTextLength();
                if(weaponLabelEle.getComputedTextLength() > labelWidth) {
                    labelWidth = weaponLabelEle.getComputedTextLength();
                }
            }
            if(labelHeight != -1 && labelBGYPos != -1 && labelWidth != -1) {
                exportLabelBG.attr('x',0).attr('y',labelBGYPos).attr('width',labelWidth).attr('height',labelHeight)
                    .attr('transform',exportLabel.attr('transform'));
            }
        }
        //over all numeric Total Import/Export labels
        var importsVisible = $("#importExportBtns .imports .check").not(".inactive").length != 0;
        var exportsVisible = $("#importExportBtns .exports .check").not(".inactive").length != 0;
        var importTotalLabel = this.barGraphSVG.selectAll('text.totalLabel').data([1]);
        importTotalLabel.enter().append('text').attr('x',midX).attr('text-anchor','end')
            .attr('class','totalLabel').attr('y',this.barGraphHeight- this.barGraphBottomPadding + 25);
        importTotalLabel.text(abbreviateNumber(importTotal)).attr('visibility',importsVisible ? "visible":"hidden");
        var exportTotalLabel = this.barGraphSVG.selectAll('text.totalLabel.totalLabel2').data([1]);
        exportTotalLabel.enter().append('text').attr('x',midX+10).attr('class','totalLabel totalLabel2').attr('y', this.barGraphHeight - this.barGraphBottomPadding+25);
        exportTotalLabel.text(abbreviateNumber(exportTotal)).attr('visibility',exportsVisible ? "visible":"hidden");
        //Import label at bottom
        var importLabel = this.barGraphSVG.selectAll('text.importLabel').data([1]);
        importLabel.enter().append('text').attr('x',midX).attr('text-anchor','end').text('IMPORTS')
            .attr('class','importLabel').attr('y', this.barGraphHeight - this.barGraphBottomPadding + 45);
        importLabel.attr('visibility',importsVisible ? "visible":"hidden");
        //Export label at bottom
        var exportLabel = this.barGraphSVG.selectAll('text.exportLabel').data([1]);
        exportLabel.enter().append('text').attr('x',midX+10).text('EXPORTS')
            .attr('class','exportLabel').attr('y', this.barGraphHeight - this.barGraphBottomPadding + 45);
        exportLabel.attr('visibility',exportsVisible ? "visible":"hidden")        
    },
    dragHandleStart: function(event) {
        console.log('start');
        event.dataTransfer.setData('text/uri-list','yearHandle.png');
        event.dataTransfer.setDragImage(document.getElementById('handle'),0,0);
        event.dataTransfer.effectAllowed='move';
    }
}

/*
This is going to be a number formatter. Example of use:

var bigNumber = 57028715;
var formated = abbreviateNumber(57028715);
return formated; //should show 57B for 57 Billion

*/
function abbreviateNumber(value) {
    
    var newValue = value;
    if (value >= 1000) {
        var suffixes = ["", "K", "M", "B","T"];
        var suffixNum = Math.floor( (""+value).length/3 );
        var shortValue = '';
        for (var precision = 3; precision >= 1; precision--) {
            shortValue = parseFloat( (suffixNum != 0 ? (value / Math.pow(1000,suffixNum) ) : value).toPrecision(precision));
            var dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g,'');
            if (dotLessShortValue.length <= 3) { break; }
        }
        if (shortValue % 1 != 0)  shortNum = shortValue.toFixed(1);
        newValue = shortValue+suffixes[suffixNum];
    }
    return '$' + newValue;
}





<!-- makers.js -->
var markers = [];

function onMarkerHover( event ){
	var hx = event.clientX - window.innerWidth * 0.5;
	var hy = event.clientY - window.innerHeight * 0.5;
	var dx = mouseX - hx;
	var dy = mouseY - hy;
	var d = Math.sqrt( dx * dx + dy * dy );
	// if( event.target.style.visibility == 'visible' )
	// 	console.log('clicked on something!!');				
}

function attachMarkerToCountry( countryName, importance ){
	//	look up the name to mesh
	countryName = countryName.toUpperCase();
	var country = countryData[countryName];
	if( country === undefined )
		return;

	var container = document.getElementById( 'visualization' );	
	var template = document.getElementById( 'marker_template' );
	var marker = template.cloneNode(true);

	country.marker = marker;
	container.appendChild( marker );

	marker.countryName = countryName;

	marker.importance = importance;
	marker.selected = false;
	marker.hover = false;
    if( countryName === selectedCountry.countryName.toUpperCase() )
		marker.selected = true;

	marker.setPosition = function(x,y,z){
		this.style.left = x + 'px';
		this.style.top = y + 'px';	
		this.style.zIndex = z;
	}

	marker.setVisible = function( vis ){
		if( ! vis )
			this.style.display = 'none';
		else{
			this.style.display = 'inline';
		}
	}
    var countryLayer = marker.querySelector( '#countryText');
    marker.countryLayer = countryLayer;
	var detailLayer = marker.querySelector( '#detailText' );
	marker.detailLayer = detailLayer;
    marker.jquery = $(marker);
	marker.setSize = function( s ){
	    var detailSize = Math.floor(2 + s * 0.5);	
		this.detailLayer.style.fontSize = detailSize + 'pt';
        var totalHeight = detailSize * 2;
		this.style.fontSize = totalHeight * 1.125 + 'pt';
		if(detailSize <= 8) {
            this.countryLayer.style.marginTop = "0px";  
		} else {
		    this.countryLayer.style.marginTop = "-1px";
		}
	}

	marker.update = function(){
		var matrix = rotating.matrixWorld;
		var abspos = matrix.multiplyVector3( country.center.clone() );
		var screenPos = screenXY(abspos);			

		var s = 0.3 + camera.scale.z * 1;
		var importanceScale = this.importance / 5000000;
		importanceScale = constrain( importanceScale, 0, 18 );
		s += importanceScale;

		if( this.tiny )
			s *= 0.75;

		if( this.selected )
			s = 30;

		if( this.hover )
			s = 15;
		
		this.setSize( s ); 

		// if( this.selected )
			// this.setVisible( true )
		// else
			this.setVisible( ( abspos.z > 60 ) && s > 3 );	

		var zIndex = Math.floor( 1000 - abspos.z + s );
		if( this.selected || this.hover )
			zIndex = 10000;

		this.setPosition( screenPos.x, screenPos.y, zIndex );	
	}

	var nameLayer = marker.querySelector( '#countryText' );		

	//	right now, something arbitrary like 10 mil dollars or more to be highlighted
	var tiny = (importance < 20000000) && (!marker.selected);	
	marker.tiny = tiny;

	// if( tiny )
	// 	nameLayer.innerHTML = country.countryCode;	
	// else
		nameLayer.innerHTML = countryName.replace(' ','&nbsp;');	

	// marker.nameLayer = nameLayer;
	// marker.nameLayerText = countryName;
	// marker.nameLayerShorten = country.countryCode;;	
	
	var importExportText = "";
	if(country.exportedAmount > 0 && country.importedAmount > 0) {
	   importExportText += "imported:&nbsp;$" + numberWithCommas(country.importedAmount) + "<br />" +
	       "exported:&nbsp;$"+numberWithCommas(country.exportedAmount);
	} else if(country.exportedAmount > 0 && country.importedAmount == 0) {
	   importExportText += "exported:&nbsp;$"+numberWithCommas(country.exportedAmount)+"<br />&nbsp;";
	} else if(country.exportedAmount == 0 && country.importedAmount > 0) {
	   importExportText += "imported:&nbsp;$"+numberWithCommas(country.importedAmount)+"<br />&nbsp;";
	}

	marker.importExportText = importExportText;


	var markerOver = function(e){
		this.detailLayer.innerHTML = importExportText;
		this.hover = true;
	}

	var markerOut = function(e){
		this.detailLayer.innerHTML = "";
		this.hover = false;
	}

	if( !tiny ) {		
		detailLayer.innerHTML = importExportText;
	}
	else{
		marker.addEventListener( 'mouseover', markerOver, false );
		marker.addEventListener( 'mouseout', markerOut, false );
	}


	var markerSelect = function(e){
		var selection = selectionData;
		selectVisualization( timeBins, selection.selectedYear, [this.countryName], selection.getExportCategories(), selection.getImportCategories() );	
	};
	marker.addEventListener('click', markerSelect, true);

	markers.push( marker );
}		

function removeMarkerFromCountry( countryName ){
	countryName = countryName.toUpperCase();
	var country = countryData[countryName];
	if( country === undefined )
		return;
	if( country.marker === undefined )
		return;

	var index = markers.indexOf(country.marker);
	if( index >= 0 )
		markers.splice( index, 1 );
	var container = document.getElementById( 'visualization' );		
	container.removeChild( country.marker );
	country.marker = undefined;		
}