var masterContainer = document.getElementById('visualization');

var mapIndexedImage;
var mapOutlineImage;

//	where in html to hold all our things
var glContainer = document.getElementById( 'glContainer' );

//	contains a list of country codes with their matching country names
var isoFile = 'country_iso3166.json';
var latlonFile = 'country_lat_lon.json'

var camera, scene, renderer;

var lookupCanvas
var lookupTexture;

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
		linewidth: 4
	} );
lineMaterial.linewidth = 4;

//	a list of the reverse for easy lookup
var reverseWeaponLookup = new Object();
for( var i in weaponLookup ){
	var name = i;
	var code = weaponLookup[i];
	reverseWeaponLookup[code] = name;
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

	scene.add( new THREE.AmbientLight( 0x333333 ) );

	light1 = new THREE.SpotLight( 0x333333, 3 );
	light1.position.x = 730;
	light1.position.y = 520;
	light1.position.z = 626;
	light1.castShadow = true;
	scene.add( light1 );

	light2 = new THREE.PointLight( 0x333333, 14.8 );
	light2.position.x = -640;
	light2.position.y = -500;
	light2.position.z = -1000;
	scene.add( light2 );


// 创建粒子geometry
	var particleCount = 8000,
		particles = new THREE.Geometry(),
		pMaterial =
			new THREE.ParticleBasicMaterial({
				color: 0xFFFFFF,
				size: 4
			});
// 依次创建单个粒子
	for(var p = 0; p < particleCount; p++) {
// 粒子范围在-250到250之间
		var pX = Math.random() * 2000 - 1000,
			pY = Math.random() * 2000 - 250,
			pZ = -Math.random() * 1000 - 250,
			particle = new THREE.Vector3(pX, pY, pZ);

// 将粒子加入粒子geometry
		particles.vertices.push(particle);
	}
// 创建粒子系统
	var particleSystem =
		new THREE.ParticleSystem(
			particles,
			pMaterial);

	particleSystem.sortParticles = true;

// 将粒子系统加入场景
	scene.add(particleSystem);

	rotating = new THREE.Object3D();

	scene.add(rotating);

	//rotating.add(particle);

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
	visualizationMesh.id = 'earth';
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

    //	-----------------------------------------------------------------------------
    //	Setup our camera
    camera = new THREE.PerspectiveCamera( 12, window.innerWidth / window.innerHeight, 1, 20000 ); 		        
	camera.position.z = 1400;
	camera.position.y = 0;
	camera.position.x = 100;
	camera.lookAt(scene.width/2, scene.height/2);
	scene.add( camera );

	var windowResize = THREEx.WindowResize(renderer, camera);
	render();
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

	//console.log("rotateX:    " + rotateX);
	//console.log("rotateY:    " + rotateY);
	//console.log("rotateVX:    " + rotateVX);
	//console.log("rotateVY:    " + rotateVY);

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
			if(mesh.id && mesh.id == "earth" && attackData.length>0 ) {
				var startpoint = attackData.pop();
				loadGeoData( startpoint );

				startpoint.pointlist = connectionTwoPoint( startpoint, attackTarget);	

				var lineColors = [];
				var lineColor = new THREE.Color( 0xe6be14 );
				var lineColorend = new THREE.Color( 0xff0000 );

				//	grab the colors from the vertices
				var geopoints = startpoint.pointlist.slice(0, 5);
				var pointstart = 0, pointlen = 5;
				var headpoint = startpoint.pointlist.slice(0, 1)
				//console.log(headpoint);
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


							var particleSystem = this.children[0];
							var particle = this.particles.vertices[0];
							var pointend = (this.pointstart + this.pointlen) < this.pointlist.length? this.pointstart + this.pointlen : this.pointlist.length-1;
							var handpoint = this.pointlist.slice(pointend, pointend+1)[0];
							particle.x = handpoint.x;
							particle.y = handpoint.y;
							particle.z = handpoint.z;
							particleSystem.geometry.__dirtyVertices = true;

							this.geometry.verticesNeedUpdate = true;
						} else {
							this.parent.remove(this);
						}
					}
				}



				var particles = new THREE.Geometry(),
					pMaterial =
						new THREE.ParticleBasicMaterial({
							color: 0xFF0000,
							size: 10
						});

				var particle = headpoint[0];

				particles.vertices.push(particle);

				var particleSystem =
					new THREE.ParticleSystem(
						particles,
						pMaterial);

				particleSystem.sortParticles = true;

				splineOutline.add(particleSystem);
				splineOutline.particles = particles;

				mesh.add(splineOutline);
			}

			if (mesh && mesh.update !== undefined) {
				mesh.update();
			}
		}
	);

	//for( var i in markers ){
	//	var marker = markers[i];
	//	marker.update();
	//}
}

function render() {	
	renderer.clear();		    					
    renderer.render( scene, camera );				
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
	//ctx.fillStyle = 'rgb(19, 33, 62)';
	//ctx.fillStyle = 'rgb(0,55,120)';
	ctx.fillStyle = 'rgb(0,20,60)';
	ctx.fillRect( 0, 0, 1, 1 ); // 在map_indexed上，像素为0的是海洋
	
	for( var i in countryCodes ){
		var countryCode = countryCodes[i];
		var colorIndex = countryColorMap[ countryCode ];

		// var fillCSS = '#ff0000';
		// var fillCSS = '#333333';
		var fillCSS = 'rgb(' + colorIndex + ',' + colorIndex + ',' + colorIndex + ')';
		if( countryCode === "CN" || countryCode === "TW" )
			//fillCSS = '#0f0';
			fillCSS = 'rgb(46, 74, 36)';

		ctx.fillStyle = fillCSS;
		ctx.fillRect( colorIndex, 0, 1, 1 );
	}
	
	lookupTexture.needsUpdate = true;
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

<!-- mousekeyboard.js -->
var mouseX = 0, mouseY = 0, pmouseX = 0, pmouseY = 0;
var pressX = 0, pressY = 0;

var dragging = false;

var rotateX = 0, rotateY = 0;
var rotateVX = 0, rotateVY = 0;
var rotateXMax = 90 * Math.PI/180;

var rotateTargetX = undefined;
var rotateTargetY = undefined;

var keyboard = new THREEx.KeyboardState();

function onDocumentMouseMove( event ) {

	pmouseX = mouseX;
	pmouseY = mouseY;

	mouseX = event.clientX - window.innerWidth * 0.5;
	mouseY = event.clientY - window.innerHeight * 0.5;

	if(dragging){
		if(keyboard.pressed("shift") == false){
			rotateVY += (mouseX - pmouseX) / 2 * Math.PI / 180 * 0.3;
			rotateVX += (mouseY - pmouseY) / 2 * Math.PI / 180 * 0.3;
		}
		else{
			camera.position.x -= (mouseX - pmouseX) * .5;
			camera.position.y += (mouseY - pmouseY) * .5;
		}
	}
}

function onDocumentMouseDown( event ) {
	if(event.target.className.indexOf('noMapDrag') !== -1) {
		return;
	}
	dragging = true;
	pressX = mouseX;
	pressY = mouseY;
	rotateTargetX = undefined;
}

function onDocumentMouseUp( event ){
	//d3Graphs.zoomBtnMouseup();
	dragging = false;
	histogramPressed = false;
}

function onClick( event ){
	//	make the rest not work if the event was actually a drag style click
	if( Math.abs(pressX - mouseX) > 3 || Math.abs(pressY - mouseY) > 3 )
		return;

	var pickColorIndex = getPickColor();
	//	find it
	for( var i in countryColorMap ){
		var countryCode = i;
		var countryColorIndex = countryColorMap[i];
		if( pickColorIndex == countryColorIndex ){
			// console.log("selecting code " + countryCode);
			var countryName = countryLookup[countryCode];
			// console.log("converts to " + countryName);
			if( countryName === undefined )
				return;
			if( $.inArray(countryName, selectableCountries) <= -1 )
				return;
			// console.log(countryName);
			var selection = selectionData;
			selection.selectedCountry = countryName;
			selectVisualization( timeBins, selection.selectedYear, [selection.selectedCountry], selection.getExportCategories(), selection.getImportCategories() );
			// console.log('selecting ' + countryName + ' from click');
			return;
		}
	}
}


function handleMWheel( delta ) {
	camera.scale.z += delta * 0.1;
	camera.scale.z = constrain( camera.scale.z, 0.7, 5.0 );
}

function onMouseWheel( event ){
	var delta = 0;

	if (event.wheelDelta) { /* IE/Opera. */
		delta = event.wheelDelta/120;
	}
	//	firefox
	else if( event.detail ){
		delta = -event.detail/3;
	}

	if (delta)
		handleMWheel(delta);

	event.returnValue = false;
}
