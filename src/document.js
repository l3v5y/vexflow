/**
 * Document - generic interface for parsing and displaying a document
 * @author Daniel Ringwalt (ringw)
 */

if (! Vex.Flow.Backend) Vex.Flow.Backend = {};

/**
 * Vex.Flow.Backend.IR - return measures from intermediate JSON representation
 * @constructor
 */
Vex.Flow.Backend.IR = function() {
  this.documentObject = null;
}

/**
 * "Parse" an existing IR document object (not necessarily a Document instance).
 * @param object The original document object
 */
Vex.Flow.Backend.IR.prototype.parse = function(object) {
  if (! Vex.Flow.Backend.IR.appearsValid(object))
    throw new Vex.RERR("InvalidArgument", "IR object must be a valid document");
  
  // Force a first-class document object to get all measures
  if (typeof object.getNumberOfMeasures == "function"
      && typeof object.getMeasure == "function") {
    var numMeasures = object.getNumberOfMeasures();
    for (var i = 0; i < numMeasures; i++) object.getMeasure(i);
  }
  this.documentObject = object;
  this.valid = true;
}

Vex.Flow.Backend.IR.prototype.isValid = function() { return this.valid; }

/**
 * Class method.
 * Returns true if the argument appears to a valid document object.
 * Used when automatically detecting VexFlow IR.
 *
 * @return {Boolean} True if object looks like a valid document.
 */
Vex.Flow.Backend.IR.appearsValid = function(object) {
  return typeof object == "object" && object.type == "document";
}

/**
 * Number of measures in the document
 *
 * @return {Number} Total number of measures
 */
Vex.Flow.Backend.IR.prototype.getNumberOfMeasures = function() {
  return this.documentObject.measures.length;
}

/**
 * Create the ith measure from this.measures[i]
 *
 * @return {Vex.Flow.Measure} ith measure as a Measure object
 */
Vex.Flow.Backend.IR.prototype.getMeasure = function(i) {
  return new Vex.Flow.Measure(this.documentObject.measures[i]);
}

/**
 * Vex.Flow.Document - generic container of measures generated by a backend
 * @constructor
 */
Vex.Flow.Document = function(data, options) {
  if (arguments.length > 0) this.init(data, options);
}

Vex.Flow.Document.backends = [Vex.Flow.Backend.IR, Vex.Flow.Backend.MusicXML];

Vex.Flow.Document.prototype.init = function(data, options) {
  this.options = {};
  Vex.Merge(this.options, options);
  this.measures = new Array();
  if (! data) {
    this.backend = null;
    return;
  }

  // Optionally pass constructor function for backend
  var backends = (typeof this.options.backend == "function")
                 ? [this.options.backend] : Vex.Flow.Document.backends;
  for (var i = 0; i < backends.length; i++) {
    var Backend = backends[i];
    if (Backend.appearsValid(data)) {
      this.backend = new Backend();
      this.backend.parse(data);
      if (! this.backend.isValid())
        throw new Vex.RERR("ParseError", "Could not parse document data");
    }
  }
  if (! this.backend)
    throw new Vex.RERR("ParseError", "Data in document is not supported");

  this.type = "document";
}

/**
 * Create a formatter with a copy of the document
 * (formatter may add clefs, etc. when formatting document)
 * @param {Function} Class of formatter
 * @return {Vex.Flow.Document.Formatter} Document formatter with document copy
 */
Vex.Flow.Document.prototype.getFormatter = function(formatterClass) {
  var Formatter = formatterClass;
  if (typeof FormatterClass != "function")
    Formatter = Vex.Flow.Document.LiquidFormatter; // default class
  return new Formatter(new Vex.Flow.Document(this));
}

/**
 * Number of measures in the document
 * @return {Number} Total number of measures
 */
Vex.Flow.Document.prototype.getNumberOfMeasures = function() {
  return this.backend.getNumberOfMeasures();
}

/**
 * Retrieve the ith measure (zero-indexed).
 * @param {Number} The zero-indexed measure to access.
 * @return {Vex.Flow.Measure} Measure object corresponding to the measure number
 */
Vex.Flow.Document.prototype.getMeasure = function(i) {
  if (i in this.measures) return this.measures[i];
  var measure = this.backend.getMeasure(i);
  this.measures[i] = measure;
  return measure;
}

/**
 * Vex.Flow.Document.Formatter - abstract base class for formatters
 * Accepts document as argument and draws document in discrete chunks
 *
 * @param {Vex.Flow.Document} Document object to retrieve information from
 * @constructor
 */
Vex.Flow.Document.Formatter = function(document) {
  if (arguments.length > 0) this.init(document);
}

Vex.Flow.Document.Formatter.prototype.init = function(document) {
  if (typeof document != "object")
    throw new Vex.RERR("ArgumentError",
      "new Vex.Flow.Document.Formatter() requires Document object argument");
  this.document = document;

  // Groups of measures are contained in blocks (which could correspond to a
  // line or a page of music.)
  // Each block is intended to be drawn on a different canvas.
  // Blocks must be managed by the subclass.
  this.measuresInBlock = []; // block # -> array of measure # in block
  this.blockDimensions = []; // block # -> [width, height]

  // Store VexFlow staves, voices, objects. Stave layout managed by subclass
  this.vfStaves = []; // measure # -> stave # -> VexFlow stave
  this.vfVoices = []; // measure # -> voice # -> VexFlow voice
  this.vfObjects = []; // measure # -> corresponding voice # -> all objects
  this.staveForVoice = []; // measure # -> array of stave # for each voice
  this.measureOptions = []; // measure # -> object of drawing options

  // Minimum measure widths can be used for formatting by subclasses
  this.minMeasureWidths = [];
}

/**
 * Vex.Flow.Document.Formatter.prototype.getStaveX: to be defined by subclass
 * Params: m (measure #), s (stave #)
 * Returns: x (number)
 */

/**
 * Calculate vertical position of stave within block
 * @param {Number} Measure number
 * @param {Number} Stave number
 */
Vex.Flow.Document.Formatter.prototype.getStaveY = function(m, s) {
  // Default behavour: calculate from stave above this one (or 0 for top stave)
  // (Have to make sure not to call getStave on this stave)
  if (s == 0) return 0;

  var higherStave = this.getStave(m, s - 1);
  return higherStave.y + higherStave.getHeight();
}

/**
 * Vex.Flow.Document.Formatter.prototype.getStaveWidth: defined in subclass
 * Params: m (measure #), s (stave #)
 * Returns: width (number) which should be less than the minimum width
 */

/**
 * Create a Vex.Flow.Stave from a Vex.Flow.Measure.Stave.
 * @param {Vex.Flow.Measure.Stave} Original stave object
 * @param {Number} x position
 * @param {Number} y position
 * @param {Number} width of stave
 * @return {Vex.Flow.Stave} Generated stave object
 */
Vex.Flow.Document.Formatter.prototype.createVexflowStave = function(s, x,y,w) {
  var vfStave = new Vex.Flow.Stave(x, y, w);
  s.modifiers.forEach(function(mod) {
    switch (mod.type) {
      case "clef": vfStave.addClef(mod.clef); break;
      case "key": vfStave.addKeySignature(mod.key); break;
      case "time":
        var time_sig;
        if (typeof mod.time == "string") time_sig = mod.time;
        else time_sig = mod.num_beats.toString() + "/" + mod.beat_value.toString();
        vfStave.addTimeSignature(time_sig);
        break;
    }
  });
  return vfStave;
}

/**
 * Use getStaveX, getStaveY, getStaveWidth to create a Vex.Flow.Stave from
 * the document and store it in vfStaves.
 * @param {Number} Measure number
 * @param {Number} Stave number
 * @return {Vex.Flow.Stave} Stave for the measure and stave #
 */
Vex.Flow.Document.Formatter.prototype.getStave = function(m, s) {
  if (m in this.vfStaves && s in this.vfStaves[m])
    return this.vfStaves[m][s];
  if (typeof this.getStaveX != "function"
      || typeof this.getStaveWidth != "function")
    throw new Vex.RERR("MethodNotImplemented",
                "Document formatter must implement getStaveX, getStaveWidth");
  var stave = this.document.getMeasure(m).getStave(s);
  if (! stave) return undefined;
  // Add stave modifiers for options
  var options = this.measureOptions[m];
  if (options) {
    if (options.system_start && stave.clef && ! stave.getModifier("clef"))
      stave.addModifier({type:"clef", clef:stave.clef});
    if (options.system_start && stave.key && ! stave.getModifier("key"))
      stave.addModifier({type:"key", key:stave.key});
    if (options.piece_start && stave.time_signature && ! stave.getModifier("time"))
      stave.addModifier({type:"time", time:stave.time_signature});
    else if (options.piece_start && stave.time && ! stave.getModifier("time"))
      stave.addModifier(Vex.Merge({type:"time"}, stave.time));
  }
  var vfStave = this.createVexflowStave(stave,
                                        this.getStaveX(m, s),
                                        this.getStaveY(m, s),
                                        this.getStaveWidth(m, s));
  if (! (m in this.vfStaves)) this.vfStaves[m] = [];
  this.vfStaves[m][s] = vfStave;
  return vfStave;
}

/**
 * Get the array of all Vex.Flow.Voices for the measure, populating
 * vfVoices, vfObjects, and staveForVoice if necessary.
 * @param {Number} Measure number
 * @return {Array} Array of Vex.Flow.Voices
 */
Vex.Flow.Document.Formatter.prototype.getVoices = function(m) {
  if (m in this.vfVoices) return this.vfVoices[m];
  var allVfVoices = [], allVfObjects = [], allStavesForVoices = [];
  var measure = this.document.getMeasure(m);
  var numParts = measure.getNumberOfParts();
  var partFirstStave = 0; // First stave in this part
  for (var i = 0; i < numParts; i++) {
    var part = measure.getPart(i);
    var partStaves = [];
    for (var s = 0; s < part.getNumberOfStaves(); s++)
      partStaves[s] = part.getStave(s);
    var numVoices = part.getNumberOfVoices();
    for (var j = 0; j < numVoices; j++) {
      var voice = part.getVoice(j);
      if (typeof voice.stave != "number")
        throw new Vex.RERR("InvalidIRError", "Voice must have stave property");
      allVfVoices.push(voice.getVexflowVoice(partStaves));
      allVfObjects.push(voice.getVexflowObjects(partStaves));
      allStavesForVoices.push(voice.stave + partFirstStave);
    }
    partFirstStave += partStaves.length;
  }
  this.vfVoices[m] = allVfVoices;
  this.vfObjects[m] = allVfObjects;
  this.staveForVoice[m] = allStavesForVoices;
  return allVfVoices;
}

Vex.Flow.Document.Formatter.prototype.getMinMeasureWidth = function(m) {
  if (! this.minMeasureWidths || ! (m in this.minMeasureWidths)) {
    var formatter = new Vex.Flow.Formatter();
    var minWidth = formatter.preCalculateMinTotalWidth(this.getVoices(m));

    // Calculate the maximum extra width on any stave (due to modifiers)
    var maxExtraWidth = 0;
    var measure = this.document.getMeasure(m);
    var numParts = measure.getNumberOfParts();
    for (var i = 0; i < numParts; i++) {
      var part = measure.getPart(i);
      var numStaves = part.getNumberOfStaves();
      for (var j = 0; j < numStaves; j++) {
        var stave = part.getStave(j);
        var vfStave = this.createVexflowStave(stave, 0, 0, 500);
        var extraWidth = 500 - (vfStave.getNoteEndX()-vfStave.getNoteStartX());
        if (extraWidth > maxExtraWidth) maxExtraWidth = extraWidth;
      }
    }
    minWidth += maxExtraWidth;
    this.minMeasureWidths[m] = minWidth;
  }
  return this.minMeasureWidths[m];
};

// Internal drawing functions
// DRAWING OPTIONS - stored in this.measureOptions
// * system_start: start of system (line), always draw clef and key signature
//                 connect all staves, multiple staves in a part may have a brace
// * piece_start: start of piece, always draw clef, key, time signature
//                Also implies system_start
// * DEFAULT: connect staves within same part, only draw given modifiers
(function(){
  function drawPart(part, vfStaves, context, options) {
    var staves = new Array(part.getNumberOfStaves());
    for (var i = 0; i < part.getNumberOfStaves(); i++)
      staves[i] = part.getStave(i);
    if (options && options.systemStart) // Start of system: add clef and key
      staves.forEach(function(s) {
        if (typeof s.clef == "string") {
          s.deleteModifier("clef");
          s.addModifier({type: "clef", clef: s.clef});
        }
      });

    var voices = new Array(part.getNumberOfVoices());
    for (var i = 0; i < part.getNumberOfVoices(); i++)
      voices[i] = part.getVoice(i);

    // Array for each stave -> array of voices corresponding to that stave
    // TODO: Set stave for each voice, then format all voices together
    var voicesForStave = new Array(part.getNumberOfStaves());
    if (staves.length == 1) {
      for (var i = 0; i < voices.length; i++) voices[i].stave = 0;
      voicesForStave[0] = voices;
    }
    else
      voices.forEach(function(voice) {
        if (typeof voice.stave != "number")
          throw new Vex.RERR("InvalidIRError",
                             "Voice in multi-stave part needs stave property");
        if (voice.stave in voicesForStave)
          voicesForStave[voice.stave].push(voice);
        else
          voicesForStave[voice.stave] = [voice];
      });
    vfStaves.forEach(function(stave) { stave.setContext(context).draw(); });
    for (var i = 0; i < staves.length; i++)
      if (voicesForStave[i] instanceof Array) {
        var vfVoices = new Array();
        for (var j = 0; j < voicesForStave[i].length; j++)
          vfVoices[j] = voicesForStave[i][j].getVexflowVoice(staves);
        var formatter = new Vex.Flow.Formatter().joinVoices(vfVoices);
        formatter.format(vfVoices, vfStaves[i].getNoteEndX()-vfStaves[i].getNoteStartX());
        for (var j = 0; j < vfVoices.length; j++) {
          vfVoices[j].draw(context, vfStaves[i]);
          var vfObjects = voicesForStave[i][j].getVexflowObjects();
          for (var obj = 0; obj < vfObjects.length; obj++)
            vfObjects[obj].setContext(context).draw();
        }
      }
  }

  function drawMeasure(measure, vfStaves, context, options) {
    var startStave = 0;
    measure.getParts().forEach(function(part) {
      var numStaves = part.getNumberOfStaves();
      var partStaves = vfStaves.slice(startStave, startStave + numStaves);
      drawPart(part, partStaves, context, options);
      startStave += numStaves;
    });
    if ((options.system_start || options.piece_start)
        && vfStaves.length > 1) {
      var connector = new Vex.Flow.StaveConnector(vfStaves[0],
                                                  vfStaves[vfStaves.length - 1]);
      connector.setType(Vex.Flow.StaveConnector.type.SINGLE);
      connector.setContext(context).draw();
    }
  }
  
  Vex.Flow.Document.Formatter.prototype.drawBlock = function(b, context) {
    this.getBlock(b);
    var formatter = this;
    this.measuresInBlock[b].forEach(function(m) {
      var stave = 0;
      while (formatter.getStave(m, stave)) stave++;
      drawMeasure(formatter.document.getMeasure(m), formatter.vfStaves[m],
                  context, formatter.measureOptions[m]);
    });
  }
})();

Vex.Flow.Document.Formatter.prototype.drawMeasure = function(m, ctx, options) {
  for (var i = 0; i < m.getNumberOfParts(); i++)
    this.drawPart(m.getPart(i), ctx, options);
}

Vex.Flow.Document.Formatter.prototype.drawPart = function(part, ctx, options) {
}

/**
 * Vex.Flow.Document.LiquidFormatter - default liquid formatter
 * Fit measures onto lines with a given width, in blocks of 1 line of music
 *
 * @constructor
 */
Vex.Flow.Document.LiquidFormatter = function(document) {
  if (arguments.length > 0) Vex.Flow.Document.Formatter.call(this, document);
  this.width = 500; // default value
}
Vex.Flow.Document.LiquidFormatter.prototype = new Vex.Flow.Document.Formatter();
Vex.Flow.Document.LiquidFormatter.constructor=Vex.Flow.Document.LiquidFormatter;

Vex.Flow.Document.LiquidFormatter.prototype.setWidth = function(width) {
  this.width = width; return this; }

Vex.Flow.Document.LiquidFormatter.prototype.getBlock = function(b) {
  if (b in this.blockDimensions) return this.blockDimensions[b];

  var startMeasure = 0;
  if (b > 0) {
    this.getBlock(b - 1);
    var prevMeasures = this.measuresInBlock[b - 1];
    startMeasure = prevMeasures[prevMeasures.length - 1] + 1;
  }
  var numMeasures = this.document.getNumberOfMeasures();
  if (startMeasure >= numMeasures) return null;
  
  // Store x, width of staves (y calculated automatically)
  if (! this.measureX) this.measureX = new Array();
  if (! this.measureWidth) this.measureWidth = new Array();

  this.measureOptions[startMeasure] = {system_start: true, piece_start: (b == 0)};

  if (this.getMinMeasureWidth(startMeasure) + 20 >= this.width) {
    // Use only this measure and the minimum possible width
    var block = [this.getMinMeasureWidth(startMeasure)+20, 0];
    this.blockDimensions[b] = block;
    this.measuresInBlock[b] = [startMeasure];
    this.measureX[startMeasure] = 10;
    this.measureWidth[startMeasure] = block.width - 20;
  }
  else {
    var curMeasure = startMeasure;
    var width = 20;
    while (width < this.width && curMeasure < numMeasures) {
      width += this.getMinMeasureWidth(curMeasure);
      curMeasure++;
    }
    var endMeasure = curMeasure - 1;
    var measureRange = [];
    for (var m = startMeasure; m <= endMeasure; m++) measureRange.push(m);
    this.measuresInBlock[b] = measureRange;

    var remainingWidth = this.width - 20; // Allocate width to measures
    for (var m = startMeasure; m <= endMeasure; m++) {
      // Set each width to the minimum
      this.measureWidth[m] = Math.ceil(this.getMinMeasureWidth(m));
      remainingWidth -= this.measureWidth[m];
    }
    // Split rest of width evenly
    var extraWidth = Math.floor(remainingWidth / (endMeasure-startMeasure + 1));
    for (var m = startMeasure; m <= endMeasure; m++)
      this.measureWidth[m] += extraWidth;
    remainingWidth -= extraWidth * (endMeasure - startMeasure + 1);
    this.measureWidth[startMeasure] += remainingWidth; // Add remainder
    // Calculate x value for each measure
    this.measureX[startMeasure] = 10;
    for (var m = startMeasure + 1; m <= endMeasure; m++)
      this.measureX[m] = this.measureX[m-1] + this.measureWidth[m-1];
    this.blockDimensions[b] = [this.width, 0];
  }

  // Calculate height of first measure, use as total height
  var i = 0;
  var lastStave = undefined;
  var stave = this.getStave(startMeasure, 0);
  while (stave) {
    lastStave = stave;
    i++;
    stave = this.getStave(startMeasure, i);
  }
  var height = this.getStaveY(startMeasure, i-1) + lastStave.getHeight();
  this.blockDimensions[b][1] = height;

  return this.blockDimensions[b];
}

Vex.Flow.Document.LiquidFormatter.prototype.getStaveX = function(m, s) {
  if (! (m in this.measureX))
    throw new Vex.RERR("FormattingError",
                "Creating stave for measure which does not belong to a block");
  return this.measureX[m];
}

Vex.Flow.Document.LiquidFormatter.prototype.getStaveWidth = function(m, s) {
  if (! (m in this.measureWidth))
    throw new Vex.RERR("FormattingError",
                "Creating stave for measure which does not belong to a block");
  return this.measureWidth[m];
}