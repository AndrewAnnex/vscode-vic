/* eslint-disable @typescript-eslint/explicit-function-return-type */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// @ts-check
'use strict';

(function () {
  // Parse label values into numbers, strings, or arrays
  function parseValue(val) {
    val = val.trim();
    if (val[0] === '(') {
      const tokens = val.replace(/[()]/g, '').split(/,/g);
      return tokens.map((v) => parseValue(v));
    } else if (val[0] === "'") {
      return val.substring(1, val.length - 1).replace(/''/g, "'");
    } else {
      return Number(val);
    }
  }

  function consumeString(string, i) {
    let token = string[i];
    while (true) {
      i++;
      const c = string[i];

      token += c;

      if (c === "'") {
        if (string[i + 1] === "'") {
          token += "'";
          i++;
        } else {
          break;
        }
      }
    }

    return { token, index: i };
  }

  function consumeArray(string, i) {
    let token = string[i];
    while (true) {
      i++;

      const c = string[i];
      if (c === "'") {
        const info = consumeString(string, i);
        token += info.token;
        i = info.index;
      } else if (c === ')') {
        token += c;
        break;
      } else {
        token += c;
      }
    }

    return { token, index: i };
  }

  // Parse the list of labels into an object
  function parseLabels(string) {
    const tokens = [];
    let lastToken = '';
    for (let i = 0, l = string.length; i < l; i++) {
      const c = string[i];
      if (c === '=' || c === ' ') {
        if (lastToken.trim() !== '') {
          tokens.push(lastToken);
        }

        lastToken = '';
      } else if (c === "'") {
        const { token, index } = consumeString(string, i);
        i = index;
        lastToken += token;
      } else if (c === '(') {
        const { token, index } = consumeArray(string, i);
        i = index;
        lastToken += token;
      } else {
        lastToken += c;
      }
    }

    if (lastToken.trim() !== '') {
      tokens.push(lastToken);
    }

    const labels = [];
    for (let i = 0, l = tokens.length; i < l; i += 2) {
      const name = tokens[i].trim();
      const val = parseValue(tokens[i + 1].trim());
      labels.push({
        name,
        value: val,
      });
    }

    return labels;
  }

  // Read string from buffer from index "from" to "to"
  function readString(buffer, from, to) {
    let str = '';
    for (let i = from; i < to; i++) {
      const value = String.fromCharCode(buffer[i]);
      if (value === '\0') {
        break;
      }

      str += value;
    }

    return str;
  }

  // Read string from buffer until "cb" returns true
  function readUntil(buffer, from, cb) {
    let str = '';
    for (let i = from; i < buffer.length; i++) {
      const c = String.fromCharCode(buffer[i]);

      if (cb(c)) {
        break;
      } else {
        str += c;
      }
    }

    return str;
  }

  function getFirstLabelInstance(labels, name, defaultValue) {
    const label = labels.find((l) => l.name === name);
    return label ? label.value : defaultValue;
  }
  ///////////////////////////////////////////////////////////
  function parseVic(buffer) {
    let byteBuffer;
    if (buffer instanceof Uint8Array) {
      byteBuffer = buffer;
      buffer = byteBuffer.buffer;
    } else {
      byteBuffer = new Uint8Array(buffer.buffer);
      buffer = buffer.buffer;
    }

    const lblsizeStr = readUntil(byteBuffer, 0, (c) => /\s/.test(c));
    const labelSize = parseInt(lblsizeStr.split('=')[1]);

    if (Number.isNaN(labelSize)) {
      throw new Error('VicarLoader: Label size not provided.');
    }

    const header = readString(byteBuffer, 0, labelSize);
    const labels = parseLabels(header);
    const LBLSIZE = getFirstLabelInstance(labels, 'LBLSIZE');
    const RECSIZE = getFirstLabelInstance(labels, 'RECSIZE');
    const ORG = getFirstLabelInstance(labels, 'ORG');
    const NS = getFirstLabelInstance(labels, 'NS');
    const NL = getFirstLabelInstance(labels, 'NL');
    const NB = getFirstLabelInstance(labels, 'NB');
    const FORMAT = getFirstLabelInstance(labels, 'FORMAT');

    const EOL = getFirstLabelInstance(labels, 'EOL', 0);
    const INTFMT = getFirstLabelInstance(labels, 'INTFMT', 'LOW');
    const REALFMT = getFirstLabelInstance(labels, 'REALFMT', 'VAX');
    const NLB = getFirstLabelInstance(labels, 'NLB', 0);
    const NBB = getFirstLabelInstance(labels, 'NBB', 0);
    // const DIM = getFirstLabelInstance(labels, 'DIM', 3);
    // const TYPE = getFirstLabelInstance(labels, 'TYPE', 'IMAGE');
    // const HOST = getFirstLabelInstance(labels, 'HOST', 'VAX-VMS');
    // const N4 = getFirstLabelInstance(labels, 'N4', 0);

    let N1, N2, N3;
    switch (ORG) {
      case 'BSQ':
        N1 = getFirstLabelInstance(labels, 'N1', NS);
        N2 = getFirstLabelInstance(labels, 'N2', NL);
        N3 = getFirstLabelInstance(labels, 'N3', NB);

        if (N1 !== NS || N2 !== NL || N3 !== NB) {
          throw new Error(
            `VicarLoader: N1, N2, N3 labels do not match NS, NL, NB in BSQ order: ${N1}, ${N2}, ${N2} != ${NS}, ${NL}, ${NB}`
          );
        }

        break;
      case 'BIL':
        N1 = getFirstLabelInstance(labels, 'N1', NS);
        N2 = getFirstLabelInstance(labels, 'N2', NB);
        N3 = getFirstLabelInstance(labels, 'N3', NL);

        if (N1 !== NS || N2 !== NB || N3 !== NL) {
          throw new Error(
            `VicarLoader: N1, N2, N3 labels do not match NS, NB, NL in BSQ order: ${N1}, ${N2}, ${N2} != ${NS}, ${NB}, ${NL}`
          );
        }

        break;
      case 'BIP':
        N1 = getFirstLabelInstance(labels, 'N1', NB);
        N2 = getFirstLabelInstance(labels, 'N2', NS);
        N3 = getFirstLabelInstance(labels, 'N3', NL);

        if (N1 !== NS || N2 !== NB || N3 !== NL) {
          throw new Error(
            `VicarLoader: N1, N2, N3 labels do not match NB, NS, NL in BSQ order: ${N1}, ${N2}, ${N2} != ${NB}, ${NS}, ${NL}`
          );
        }

        break;
    }

    const imageOffset = LBLSIZE;
    const imageSize = RECSIZE * (N2 * N3 + NLB);

    if (EOL === 1) {
      const eolOffset = imageOffset + imageSize;
      const eolLabelStr = readUntil(byteBuffer, eolOffset, (c) => /\s/.test(c));
      const eolLabelSize = parseInt(eolLabelStr.split('=')[1]);
      const eolHeader = readString(
        byteBuffer,
        eolOffset,
        eolOffset + eolLabelSize
      );
      const eolLabels = parseLabels(eolHeader);
      labels.push(...eolLabels);
    }

    let cons;
    let readFunc;
    let littleEndian;
    let complex = false;
    switch (FORMAT) {
      case 'BYTE':
        cons = Uint8Array;
        readFunc = 'getUint8';
        littleEndian = INTFMT === 'LOW';
        break;
      case 'WORD':
      case 'HALF':
        cons = Int16Array;
        readFunc = 'getInt16';
        littleEndian = INTFMT === 'LOW';
        break;
      case 'LONG':
      case 'FULL':
        cons = Int32Array;
        readFunc = 'getInt32';
        littleEndian = INTFMT === 'LOW';
        break;
      case 'REAL':
        cons = Float32Array;
        readFunc = 'getFloat32';
        littleEndian = REALFMT === 'RIEEE';
        if (labels.REALFMT === 'VAX') {
          throw new Error('VicarLoader: VAX REALFMT not supported.');
        }

        break;
      case 'DOUB':
        cons = Float64Array;
        readFunc = 'getFloat64';
        littleEndian = REALFMT === 'RIEEE';
        if (REALFMT === 'VAX') {
          throw new Error('VicarLoader: VAX REALFMT not supported.');
        }

        break;
      case 'COMPLEX':
      case 'COMP':
        complex = true;
        cons = Float32Array;
        readFunc = 'getFloat32';
        littleEndian = REALFMT === 'RIEEE';
        if (REALFMT === 'VAX') {
          throw new Error('VicarLoader: VAX REALFMT not supported.');
        }

        break;
    }

    const dataOffset = imageOffset + NLB * RECSIZE;
    const dataSize = imageSize - NLB * RECSIZE;
    const view = new DataView(
      buffer,
      byteBuffer.byteOffset + dataOffset,
      dataSize
    );
    const data = new cons(N1 * N2 * N3);
    const prefixData = new Uint8Array(NBB * N2 * N3);

    const recsize = RECSIZE;
    const pxlSize = cons.BYTES_PER_ELEMENT;
    const nbb = NBB;
    for (let i3 = 0, l3 = N3; i3 < l3; i3++) {
      for (let i2 = 0, l2 = N2; i2 < l2; i2++) {
        // row number
        const row = i3 * l2 + i2;

        // row start index in bytes
        const rowStart = row * recsize;

        // copy the row data
        for (let i1 = 0, l1 = N1; i1 < l1; i1++) {
          const byteOffset = rowStart + nbb + i1 * pxlSize;
          const index = row * l1 + i1;
          data[index] = view[readFunc](byteOffset, littleEndian);
          if (complex) {
            data[index + 1] = view[readFunc](byteOffset + 4, littleEndian);
          }
        }

        // copy the prefix data
        for (let ib = 0; ib < nbb; ib++) {
          const byteOffset = rowStart + ib;
          const index = row * nbb + ib;
          prefixData[index] = view.getUint8(byteOffset);
        }
      }
    }

    const width = NS;
    const prefixWidth = NBB;
    const height = NL;
    const depth = NB;

    if (NLB !== 0) {
      console.warn(
        'VicarLoader: NLB Data is present but is not being procesed.'
      );
    }

    return {
      labels,

      data,
      width,
      height,
      depth,

      prefixData,
      prefixWidth,

      complex,
    };
  }

  ///////////////////////////////////////////////////////////

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @return {number}
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getSettings() {
    const element = document.getElementById('image-preview-settings');
    if (element) {
      const data = element.getAttribute('data-settings');
      if (data) {
        return JSON.parse(data);
      }
    }

    throw new Error(`Could not load settings`);
  }

  /**
   * Enable image-rendering: pixelated for images scaled by more than this.
   */
  const PIXELATION_THRESHOLD = 3;

  const SCALE_PINCH_FACTOR = 0.075;
  const MAX_SCALE = 20;
  const MIN_SCALE = 0.1;

  const zoomLevels = [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 3, 5, 7, 10, 15, 20,
  ];

  const settings = getSettings();
  const isMac = settings.isMac;

  const vscode = acquireVsCodeApi();

  const initialState = vscode.getState() || {
    scale: 'fit',
    offsetX: 0,
    offsetY: 0,
  };

  // State
  let scale = initialState.scale;
  console.log('SCALE', scale);
  let ctrlPressed = false;
  let altPressed = false;
  let hasLoadedImage = false;
  let consumeClick = true;
  let isActive = false;

  // Elements
  const container = document.body;
  const image = document.createElement('img');

  // Vicar Loader
  //const vicloaderbase = new VicarLoaderBase();

  function updateScale(newScale) {
    if (!image || !hasLoadedImage || !image.parentElement) {
      console.log('error');
      return;
    }

    if (newScale === 'fit') {
      scale = 'fit';
      image.classList.add('scale-to-fit');
      image.classList.remove('pixelated');
      image.style.minWidth = 'auto';
      image.style.width = 'auto';
      vscode.setState(undefined);
    } else {
      scale = clamp(newScale, MIN_SCALE, MAX_SCALE);
      if (scale >= PIXELATION_THRESHOLD) {
        image.classList.add('pixelated');
      } else {
        image.classList.remove('pixelated');
      }

      const dx =
        (window.scrollX + container.clientWidth / 2) / container.scrollWidth;
      const dy =
        (window.scrollY + container.clientHeight / 2) / container.scrollHeight;

      image.classList.remove('scale-to-fit');
      image.style.minWidth = `${image.naturalWidth * scale}px`;
      image.style.width = `${image.naturalWidth * scale}px`;

      const newScrollX = container.scrollWidth * dx - container.clientWidth / 2;
      const newScrollY =
        container.scrollHeight * dy - container.clientHeight / 2;

      window.scrollTo(newScrollX, newScrollY);

      vscode.setState({
        scale: scale,
        offsetX: newScrollX,
        offsetY: newScrollY,
      });
    }

    vscode.postMessage({
      type: 'zoom',
      value: scale,
    });
  }

  function setActive(value) {
    isActive = value;
    if (value) {
      if (isMac ? altPressed : ctrlPressed) {
        container.classList.remove('zoom-in');
        container.classList.add('zoom-out');
      } else {
        container.classList.remove('zoom-out');
        container.classList.add('zoom-in');
      }
    } else {
      ctrlPressed = false;
      altPressed = false;
      container.classList.remove('zoom-out');
      container.classList.remove('zoom-in');
    }
  }

  function firstZoom() {
    console.log('firstZoom');
    if (!image || !hasLoadedImage) {
      return;
    }

    scale = image.clientWidth / image.naturalWidth;
    updateScale(scale);
  }

  function parseVicToCanvas(buffer) {
    // https://github.com/NASA-AMMOS/CameraModelUtilsJS/blob/main/src/vicar-loader/VicarLoader.js
    // https://github.com/seikichi/tiff.js/blob/545ede3ee46b5a5bc5f06d65954e775aa2a64017/tiff_api.ts#L85
    const result = buffer;
    // find the min and max value
    // TODO: figure this out?
    let max = -Infinity;
    const stride = result.width * result.height;
    for (let i = 0; i < stride; i++) {
      const r = result.data[stride * 0 + i];
      const g = result.data[stride * 1 + i];
      const b = result.data[stride * 2 + i];
      // max = Math.max( max, r, g, b );

      if (r) max = Math.max(max, r);
      if (g) max = Math.max(max, g);
      if (b) max = Math.max(max, b);
    }

    // Assume BSQ organization
    const ORG = result.labels.find((label) => label.name === 'ORG').value;
    if (ORG !== 'BSQ') {
      throw new Error(
        'VicarLoader: File is not in BSQ order which is the only supported organization for the file at the moment.'
      );
    }

    let maxValue = max;
    if (
      !(result.data instanceof Float32Array) ||
      !(result.data instanceof Float64Array)
    ) {
      const usefulBits = Math.ceil(Math.log(max) / Math.LN2);
      maxValue = 2 ** usefulBits;
    } else if (result.data instanceof Uint8Array) {
      maxValue = 255;
    }

    const data = new Uint8ClampedArray(stride * 4);
    for (let i = 0; i < stride; i++) {
      const r = result.data[stride * 0 + i] / maxValue;
      let g, b;
      if (result.depth === 1) {
        g = r;
        b = r;
      } else if (result.depth === 2) {
        g = result.data[stride * 1 + i] / maxValue;
        b = 0;
      } else {
        g = result.data[stride * 1 + i] / maxValue;
        b = result.data[stride * 2 + i] / maxValue;
      }

      data[i * 4 + 0] = r * 255;
      data[i * 4 + 1] = g * 255;
      data[i * 4 + 2] = b * 255;
      data[i * 4 + 3] = 255;
    }

    // Vicar files always have 3 dimensions and is in "data"

    //texture.flipY = true; // only thing not done
    const width = result.width;
    const height = result.height;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    console.log('canvas: ', canvas);
    if (context !== null) {
      canvas.width = width;
      canvas.height = height;
      const imageData = context.createImageData(width, height);
      // todo look to see if data is the correct dimensions etc
      imageData.data.set(data);
      context.putImageData(imageData, 0, 0);
    }
    return canvas;
  }

  function loadVicImage(filename) {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open('GET', filename);
    xhr.onload = function (e) {
      const vicresult = parseVic({ buffer: xhr.response });
      const width = vicresult.width;
      const height = vicresult.height;
      // logic to make the canvas above
      const canvas = parseVicToCanvas(vicresult);

      if (canvas) {
        const dataUrl = canvas.toDataURL();
        // canvas.setAttribute('style', 'width:' + (width*0.3) +
        //   'px; height: ' + (height*0.3) + 'px');
        image.src = dataUrl;
        // image.setAttribute('style', 'width:' + (width) +
        //    'px; height: ' + (height) + 'px');
        // image.width = width + 'px';
        // image.height = height + 'px';
        console.log('image', width, height);

        vscode.postMessage({
          type: 'size',
          value: `${image.naturalWidth}x${image.naturalHeight}`,
        });

        document.body.classList.remove('loading');
        document.body.classList.add('ready');
        document.body.append(image);

        updateScale(scale);

        if (initialState.scale !== 'fit') {
          window.scrollTo(initialState.offsetX, initialState.offsetY);
        }
      } else {
        return;
      }
    };
    xhr.send();
  }
  function zoomIn() {
    console.log('ZoomIn');
    if (scale === 'fit') {
      firstZoom();
    }

    let i = 0;
    for (; i < zoomLevels.length; ++i) {
      if (zoomLevels[i] > scale) {
        break;
      }
    }
    updateScale(zoomLevels[i] || MAX_SCALE);
  }

  function zoomOut() {
    console.log('ZoomOut');
    if (scale === 'fit') {
      firstZoom();
    }

    let i = zoomLevels.length - 1;
    for (; i >= 0; --i) {
      if (zoomLevels[i] < scale) {
        break;
      }
    }
    updateScale(zoomLevels[i] || MIN_SCALE);
  }

  window.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
    if (!image || !hasLoadedImage) {
      return;
    }
    ctrlPressed = e.ctrlKey;
    altPressed = e.altKey;

    if (isMac ? altPressed : ctrlPressed) {
      container.classList.remove('zoom-in');
      container.classList.add('zoom-out');
    }
  });

  window.addEventListener('keyup', (/** @type {KeyboardEvent} */ e) => {
    if (!image || !hasLoadedImage) {
      return;
    }

    ctrlPressed = e.ctrlKey;
    altPressed = e.altKey;

    if (!(isMac ? altPressed : ctrlPressed)) {
      container.classList.remove('zoom-out');
      container.classList.add('zoom-in');
    }
  });

  container.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
    console.log('mouseDown');
    if (!image || !hasLoadedImage) {
      console.log('mouseDown a');
      return;
    }

    if (e.button !== 0) {
      console.log('mouseDown b');
      return;
    }

    ctrlPressed = e.ctrlKey;
    altPressed = e.altKey;
    consumeClick = !isActive;
    console.log('mouseDown ', consumeClick);
  });

  container.addEventListener('click', (/** @type {MouseEvent} */ e) => {
    console.log('Click.....', consumeClick);
    if (!image || !hasLoadedImage) {
      console.log('slip 1');
      return;
    }

    if (e.button !== 0) {
      console.log('a');
      return;
    }

    if (consumeClick) {
      consumeClick = false;
      console.log('b');
      return;
    }
    // left click
    if (scale === 'fit') {
      firstZoom();
    }

    if (!(isMac ? altPressed : ctrlPressed)) {
      // zoom in
      zoomIn();
    } else {
      zoomOut();
    }
  });

  container.addEventListener(
    'wheel',
    (/** @type {WheelEvent} */ e) => {
      // Prevent pinch to zoom
      if (e.ctrlKey) {
        e.preventDefault();
      }

      if (!image || !hasLoadedImage) {
        return;
      }

      const isScrollWheelKeyPressed = isMac ? altPressed : ctrlPressed;
      if (!isScrollWheelKeyPressed && !e.ctrlKey) {
        // pinching is reported as scroll wheel + ctrl
        return;
      }

      if (scale === 'fit') {
        firstZoom();
      }

      const delta = e.deltaY > 0 ? 1 : -1;
      updateScale(scale * (1 - delta * SCALE_PINCH_FACTOR));
    },
    { passive: false }
  );

  window.addEventListener(
    'scroll',
    (e) => {
      if (
        !image ||
        !hasLoadedImage ||
        !image.parentElement ||
        scale === 'fit'
      ) {
        return;
      }

      const entry = vscode.getState();
      if (entry) {
        vscode.setState({
          scale: entry.scale,
          offsetX: window.scrollX,
          offsetY: window.scrollY,
        });
      }
    },
    { passive: true }
  );

  container.classList.add('image');

  image.classList.add('scale-to-fit');

  window.addEventListener('load', () => {
    if (hasLoadedImage) {
      return;
    }
    hasLoadedImage = true;
    loadVicImage(settings.src);

    vscode.postMessage({
      type: 'size',
      value: `${image.naturalWidth}x${image.naturalHeight}`,
    });

    // document.body.classList.remove('loading');
    // document.body.classList.add('ready');
    // document.body.append(image);

    // updateScale(scale);

    // if (initialState.scale !== 'fit') {
    // 	window.scrollTo(initialState.offsetX, initialState.offsetY);
    // }
  });

  image.addEventListener('error', (e) => {
    if (hasLoadedImage) {
      return;
    }

    hasLoadedImage = true;
    document.body.classList.add('error');
    document.body.classList.remove('loading');
  });

  document.querySelector('.open-file-link').addEventListener('click', () => {
    vscode.postMessage({
      type: 'reopen-as-text',
    });
  });

  window.addEventListener('message', (e) => {
    switch (e.data.type) {
      case 'setScale':
        updateScale(e.data.scale);
        break;

      case 'setActive':
        setActive(e.data.value);
        break;

      case 'zoomIn':
        zoomIn();
        break;

      case 'zoomOut':
        zoomOut();
        break;
    }
  });
})();
