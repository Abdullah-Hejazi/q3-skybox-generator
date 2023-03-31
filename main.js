const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

let isProcessing = false;

class CubeFace {
	constructor(faceName) {
		this.faceName = `${dom.shadername.value}_${faceName}`;

		this.div = document.createElement('div');
		this.div.className = 'face';

		this.anchor = document.createElement('a');
		this.anchor.className = 'face-anchor';

		this.img = document.createElement('img');
		this.img.className = 'face-img';

		this.title = document.createElement('div');
		this.title.className = 'face-title';
		this.title.textContent = this.faceName;

		this.anchor.appendChild(this.img);
		this.div.appendChild(this.anchor);
		this.div.appendChild(this.title);
	}

	setPreview(url) {
		this.img.src = url;
	}

	setDownload(url) {
		this.anchor.href = url;
		this.anchor.download = `${this.faceName}.jpg`;
	}
}

function removeChildren(node) {
	while (node.firstChild) {
		node.removeChild(node.firstChild);
	}
}

function getDataURL(imgData) {
	canvas.width = imgData.width;
	canvas.height = imgData.height;
	ctx.putImageData(imgData, 0, 0);

	return new Promise(resolve => {
		canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/jpeg', 0.92);
	});
}

const dom = {
	imageInput: document.getElementById('imageInput'),
	faces: 		document.getElementById('faces'),
	generating: document.getElementById('generating'),
	shadername: document.getElementById('shadername')
};

const facePositions = {
	rt: {x: 1, y: 1},
	lf: {x: 3, y: 1},
	ft: {x: 2, y: 1},
	bk: {x: 0, y: 1},
	up: {x: 1, y: 0},
	dn: {x: 1, y: 2}
};

function startGenerating() {
	const shadername = dom.shadername.value

	if (!shadername) {
		return;
	}

	if (isProcessing) {
		return;
	}

	loadImage()
}

function loadImage() {
	const file = dom.imageInput.files[0];

	if (!file) {
		return;
	}

	const img = new Image();

	img.src = URL.createObjectURL(file);

	img.addEventListener('load', () => {
		const {width, height} = img;
		canvas.width = width;
		canvas.height = height;
		ctx.drawImage(img, 0, 0);
		const data = ctx.getImageData(0, 0, width, height);

		processImage(data);
	});
}

let finished = 0;
let workers = [];

function processImage(data) {
	removeChildren(dom.faces);
	dom.generating.style.visibility = 'visible';
	document.getElementById('clickhint').style.visibility = 'hidden';
	document.getElementById('shader').style.visibility = 'hidden';
	isProcessing = true;

	for (let worker of workers) {
		worker.terminate();
	}

	for (let [faceName] of Object.entries(facePositions)) {
		renderFace(data, faceName);
	}
}

function renderFace(data, faceName) {
	const face = new CubeFace(faceName);
	dom.faces.appendChild(face.div);

	const options = {
		data: data,
		face: faceName,
		rotation: Math.PI,
		interpolation: 'lanczos',
	};

	const worker = new Worker('convert.js');

	const setDownload = ({data: imageData}) => {
		getDataURL(imageData).then(url => face.setDownload(url));

		finished++;

		if (finished === 6) {
			dom.generating.style.visibility = 'hidden';
			document.getElementById('clickhint').style.visibility = 'visible';
			document.getElementById('shader').style.visibility = 'visible';

			generateShaderFile();
		}
	};

	const setPreview = ({data: imageData}) => {
		getDataURL(imageData, 'jpg').then(url => face.setPreview(url));

		worker.onmessage = setDownload;
		worker.postMessage(options);
	};

	worker.onmessage = setPreview;

	worker.postMessage(Object.assign({}, options, {
		maxWidth: 200,
		interpolation: 'linear',
	}));

	workers.push(worker);
}


function generateShaderFile() {
	finished = 0;
	workers = [];
	isProcessing = false;

	const shadername = dom.shadername.value

	if (!shadername) {
		return;
	}

	const shader = document.getElementById('shadercode');
	
	let shaderText = `textures/${shadername}/${shadername}`

	shaderText += ` {
	qer_editorimage textures/${shadername}/${shadername}_ft.jpg
	surfaceparm noimpact
	surfaceparm nolightmap
	q3map_globaltexture
	q3map_lightsubdivide 256
	q3map_surfacelight 100
	surfaceparm sky
	q3map_sun 1 1 1 100 260 35
	skyparms textures/${shadername}/${shadername} - -\n}`

	shader.innerHTML = shaderText;

	const shaderFile = new Blob([shaderText], {type: 'text/plain'});
	const shaderURL = URL.createObjectURL(shaderFile);

	const shaderAnchor = document.getElementById('shaderlink');

	shaderAnchor.href = shaderURL;
	shaderAnchor.download = `${shadername}.shader`;
}
