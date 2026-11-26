/*
 * Listen button for essays.
 *
 * Two ways of reading, chosen per essay:
 *
 * 1. Recorded narration. If the button has data-audio and data-timings, the page
 *    plays that MP3, highlights each word as it is spoken (the timings file has a
 *    start and end time for every word), and jumps the audio when a word is tapped.
 *
 * 2. Device voice. With no recording, the essay is read by the visitor's own
 *    browser voice, one sentence at a time, with the sentence highlighted and
 *    tap-a-sentence-to-jump. The voice then differs from device to device.
 *
 * Either way the essay's text is only wrapped in spans once Listen is pressed.
 */
(function () {
    'use strict';

    var button = document.querySelector('.listen');
    var essay = document.querySelector('.essay');
    if (!button || !essay) { return; }

    var label = button.querySelector('.listen-label');
    var status = document.querySelector('.listen-status');
    var timeEl = document.querySelector('.listen-time');
    var credit = document.querySelector('.listen-credit');

    var audioSrc = button.getAttribute('data-audio');
    var timingsSrc = button.getAttribute('data-timings');
    var synth = window.speechSynthesis;
    var canSpeak = !!(synth && typeof window.SpeechSynthesisUtterance === 'function');
    var mode = audioSrc && timingsSrc ? 'audio' : (canSpeak ? 'speech' : null);
    if (!mode) { return; }

    var HINT_WORD = 'Tap or click any word to jump to it.';
    var HINT_SENTENCE = 'Tap or click any sentence to jump to it.';

    var sentences = [];      // { text, spans, firstWord }
    var words = [];          // { spans, sentence }
    var prepared = false;
    var state = 'idle';      // idle | playing | paused
    var readingSentence = -1;
    var readingWord = -1;
    var lastUserScroll = 0;  // when the reader last scrolled by hand
    var hint = '';

    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ---------- Splitting the essay into sentences and words ---------- */

    // Where each sentence starts and ends inside a block of text. Simple rule:
    // a sentence ends at . ! or ? (plus any closing quote). A full stop with a
    // digit straight after it is a decimal point ("5.2"), not an ending.
    // Abbreviations with full stops would be split too early; none are used so far.
    function findSentences(text) {
        var pattern = /(?:[^.!?]|\.(?=\d))+[.!?]+[”"’')]*|(?:[^.!?]|\.(?=\d))+$/g;
        var ranges = [];
        var match;
        while ((match = pattern.exec(text)) !== null) {
            var raw = match[0];
            var spoken = raw.replace(/\s+/g, ' ').trim();
            if (!spoken) { continue; }
            var start = match.index + raw.match(/^\s*/)[0].length;
            var end = match.index + raw.replace(/\s+$/, '').length;
            var last = ranges[ranges.length - 1];
            // A piece starting in lower case continues the sentence before it
            // (for example after a quoted question), so keep the two together.
            if (last && /^[a-z]/.test(spoken)) {
                last.end = end;
                last.text += ' ' + spoken;
            } else {
                ranges.push({ start: start, end: end, text: spoken });
            }
        }
        return ranges;
    }

    // A word is any run of characters between spaces, punctuation included.
    // This must match how the timings file was made: one entry per such run.
    function findWords(text) {
        var pattern = /\S+/g;
        var ranges = [];
        var match;
        while ((match = pattern.exec(text)) !== null) {
            ranges.push({ start: match.index, end: match.index + match[0].length });
        }
        return ranges;
    }

    function makeSpan(className, attribute, value) {
        var span = document.createElement('span');
        span.className = className;
        span.setAttribute(attribute, String(value));
        return span;
    }

    // Wrap a heading or paragraph as: sentence spans, each holding word spans.
    // Text that runs across bold or linked text gets one span per piece.
    function wrapBlock(block) {
        var text = block.textContent;
        var sentenceRanges = findSentences(text);
        if (!sentenceRanges.length) { return; }
        var wordRanges = findWords(text);

        var sentenceBase = sentences.length;
        var wordBase = words.length;

        sentenceRanges.forEach(function (range) {
            sentences.push({ text: range.text, spans: [], firstWord: -1 });
        });
        wordRanges.forEach(function (range, w) {
            var owner = -1;
            for (var s = 0; s < sentenceRanges.length; s += 1) {
                if (range.start >= sentenceRanges[s].start && range.start < sentenceRanges[s].end) { owner = sentenceBase + s; break; }
            }
            words.push({ spans: [], sentence: owner });
            if (owner >= 0 && sentences[owner].firstWord < 0) { sentences[owner].firstWord = wordBase + w; }
        });

        var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
        var textNodes = [];
        var node;
        while ((node = walker.nextNode())) { textNodes.push(node); }

        var offset = 0;
        textNodes.forEach(function (textNode) {
            var value = textNode.nodeValue;
            var nodeStart = offset;
            var nodeEnd = offset + value.length;
            offset = nodeEnd;

            var slice = function (from, to) { return value.slice(from - nodeStart, to - nodeStart); };
            var pieces = document.createDocumentFragment();
            var cursor = nodeStart;

            sentenceRanges.forEach(function (sentence, s) {
                var from = Math.max(sentence.start, nodeStart);
                var to = Math.min(sentence.end, nodeEnd);
                if (from >= to) { return; }
                if (from > cursor) { pieces.appendChild(document.createTextNode(slice(cursor, from))); }

                var sentenceSpan = makeSpan('sentence', 'data-sentence', sentenceBase + s);
                var inner = from;
                wordRanges.forEach(function (word, w) {
                    var wordFrom = Math.max(word.start, from);
                    var wordTo = Math.min(word.end, to);
                    if (wordFrom >= wordTo) { return; }
                    if (wordFrom > inner) { sentenceSpan.appendChild(document.createTextNode(slice(inner, wordFrom))); }
                    var wordSpan = makeSpan('word', 'data-word', wordBase + w);
                    wordSpan.textContent = slice(wordFrom, wordTo);
                    words[wordBase + w].spans.push(wordSpan);
                    sentenceSpan.appendChild(wordSpan);
                    inner = wordTo;
                });
                if (inner < to) { sentenceSpan.appendChild(document.createTextNode(slice(inner, to))); }

                sentences[sentenceBase + s].spans.push(sentenceSpan);
                pieces.appendChild(sentenceSpan);
                cursor = to;
            });

            if (cursor < nodeEnd) { pieces.appendChild(document.createTextNode(slice(cursor, nodeEnd))); }
            textNode.parentNode.replaceChild(pieces, textNode);
        });
    }

    function prepare() {
        if (prepared) { return; }
        // Paragraphs marked data-listen-skip (notes added after recording) aren't in the narration.
        var blocks = essay.querySelectorAll('.essay-title, h2, p:not([data-listen-skip])');
        Array.prototype.forEach.call(blocks, wrapBlock);
        prepared = true;
    }

    /* ---------- Showing where we are ---------- */

    // Bring the element on screen if it has scrolled out of view. When the page
    // is just reading along, leave the reader alone if they scrolled a moment ago.
    function keepInView(element, becauseReaderJumped) {
        if (!element) { return; }
        if (!becauseReaderJumped && Date.now() - lastUserScroll < 4000) { return; }
        var box = element.getBoundingClientRect();
        var viewport = window.innerHeight || document.documentElement.clientHeight;
        if (box.top >= 0 && box.bottom <= viewport) { return; }
        element.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function mark(list, index, className, on) {
        if (index < 0 || !list[index]) { return; }
        list[index].spans.forEach(function (span) {
            if (on) { span.classList.add(className); } else { span.classList.remove(className); }
        });
    }

    function highlightSentence(i, becauseReaderJumped) {
        if (i === readingSentence) { return; }
        mark(sentences, readingSentence, 'is-reading', false);
        readingSentence = i;
        mark(sentences, i, 'is-reading', true);
        if (mode === 'speech' && i >= 0 && sentences[i]) { keepInView(sentences[i].spans[0], becauseReaderJumped); }
    }

    function highlightWord(i, becauseReaderJumped) {
        if (i === readingWord) { return; }
        mark(words, readingWord, 'is-reading', false);
        readingWord = i;
        mark(words, i, 'is-reading', true);
        if (i >= 0 && words[i]) {
            highlightSentence(words[i].sentence, becauseReaderJumped);
            keepInView(words[i].spans[0], becauseReaderJumped);
        }
    }

    function clearHighlights() {
        highlightWord(-1);
        highlightSentence(-1);
    }

    function setState(next) {
        state = next;
        var listening = next !== 'idle';
        button.setAttribute('data-state', next);
        label.textContent = next === 'playing' ? 'Pause' : next === 'paused' ? 'Resume' : 'Listen';
        if (listening) { essay.classList.add('is-listening'); } else { essay.classList.remove('is-listening'); }
        if (status) { status.textContent = listening ? hint : ''; }
    }

    function fail(message) {
        clearHighlights();
        setState('idle');
        if (status) { status.textContent = message; }
    }

    /* ---------- Recorded narration ---------- */

    var audio = null;
    var timings = null;      // { duration, words: [[start, end], ...] } once loaded and checked
    var frame = 0;
    var shownSecond = -1;

    function clock(seconds) {
        var s = Math.max(0, Math.floor(seconds));
        return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
    }

    function showTime() {
        if (!timeEl || !audio) { return; }
        var second = Math.floor(audio.currentTime);
        if (second === shownSecond) { return; }
        shownSecond = second;
        var total = timings ? timings.duration : audio.duration;
        timeEl.textContent = clock(audio.currentTime) + (isFinite(total) && total > 0 ? ' / ' + clock(total) : '');
        timeEl.hidden = false;
    }

    // The word being spoken at time t: the last word that has started.
    function wordAt(t) {
        var list = timings.words;
        var low = 0;
        var high = list.length - 1;
        var found = -1;
        while (low <= high) {
            var mid = (low + high) >> 1;
            if (list[mid][0] <= t) { found = mid; low = mid + 1; } else { high = mid - 1; }
        }
        return found;
    }

    // Light a word a hair before it sounds. A highlight that leads by a few
    // hundredths of a second reads as on time; one that lags looks late. It also
    // means a jump, which lands just ahead of a word, lights that word at once.
    var LEAD = 0.03;

    function sync(becauseReaderJumped) {
        if (!audio) { return; }
        showTime();
        if (timings) { highlightWord(wordAt(audio.currentTime + LEAD), becauseReaderJumped); }
    }

    function loop() {
        sync(false);
        frame = state === 'playing' ? window.requestAnimationFrame(loop) : 0;
    }

    function loadTimings() {
        window.fetch(timingsSrc)
            .then(function (response) {
                if (!response.ok) { throw new Error('timings ' + response.status); }
                return response.json();
            })
            .then(function (data) {
                // One timing per word on the page, or the highlight would drift.
                if (!data || !data.words || data.words.length !== words.length) { return; }
                timings = data;
                hint = HINT_WORD;
                if (state !== 'idle' && status) { status.textContent = hint; }
                sync(false);
            })
            .catch(function () { /* audio still plays, just without highlighting */ });
    }

    function setUpAudio() {
        audio = new window.Audio();
        audio.preload = 'auto';
        audio.src = audioSrc;
        audio.title = button.getAttribute('data-title') || document.title;

        audio.addEventListener('play', function () {
            setState('playing');
            if (!frame) { frame = window.requestAnimationFrame(loop); }
        });
        audio.addEventListener('pause', function () {
            if (!audio.ended && state !== 'idle') { setState('paused'); }
        });
        audio.addEventListener('ended', function () {
            audio.currentTime = 0;
            shownSecond = -1;
            if (timeEl) { timeEl.hidden = true; }
            clearHighlights();
            setState('idle');
        });
        audio.addEventListener('timeupdate', function () { sync(false); });
        audio.addEventListener('error', function () { fail('The narration could not be loaded.'); });

        // Lock-screen and headphone controls show this title.
        if (window.navigator.mediaSession && window.MediaMetadata) {
            window.navigator.mediaSession.metadata = new window.MediaMetadata({
                title: audio.title,
                artist: window.location.hostname
            });
        }
    }

    function playAudio() {
        if (!audio) { setUpAudio(); loadTimings(); }
        setState('playing');
        var started = audio.play();
        if (started && started.catch) {
            started.catch(function () { fail('The narration could not be played.'); });
        }
    }

    function seekToWord(i) {
        if (!audio || !timings || !timings.words[i]) { return; }
        audio.currentTime = Math.max(0, timings.words[i][0] - 0.02);
        sync(true);
        if (audio.paused) { playAudio(); }
    }

    /* ---------- Device voice ---------- */

    var index = 0;        // the sentence being read, or the next one to read
    var run = 0;          // bumped whenever we stop or jump, so stale callbacks are ignored
    var current = null;   // keeps the utterance alive; some browsers drop it mid-speech otherwise
    var lang = /^en\b/i.test(window.navigator.language || '') ? window.navigator.language : 'en-GB';

    function speakNext(myRun) {
        if (myRun !== run) { return; }

        if (index >= sentences.length) {   // reached the end
            index = 0;
            clearHighlights();
            setState('idle');
            return;
        }

        highlightSentence(index, false);

        var utterance = new window.SpeechSynthesisUtterance(sentences[index].text);
        utterance.lang = lang;

        utterance.onend = function () {
            if (myRun !== run) { return; }
            index += 1;
            speakNext(myRun);
        };

        utterance.onerror = function (event) {
            if (myRun !== run) { return; }   // we stopped it ourselves
            run += 1;
            if (event && (event.error === 'interrupted' || event.error === 'canceled')) {
                setState('paused');          // something else cut in; Resume picks up here
                return;
            }
            index = 0;
            fail('This browser could not read the essay aloud.');
        };

        current = utterance;
        synth.speak(utterance);
    }

    // Start reading from sentence i. If something is being spoken right now it
    // has to be cancelled first, and browsers need a moment after a cancel
    // before they will reliably speak again.
    function speakFrom(i, speakingNow) {
        run += 1;
        var myRun = run;
        index = i;
        setState('playing');
        highlightSentence(i, true);
        if (speakingNow) {
            synth.cancel();
            window.setTimeout(function () { speakNext(myRun); }, 150);
        } else {
            speakNext(myRun);
        }
    }

    /* ---------- Controls ---------- */

    function play() {
        prepare();
        if (mode === 'audio') { playAudio(); } else { speakFrom(index, false); }
    }

    function pause() {
        if (mode === 'audio') {
            audio.pause();
        } else {
            run += 1;
            synth.cancel();
            setState('paused');   // the highlight stays, to show where Resume picks up
        }
    }

    function jumpToSentence(i) {
        if (i < 0 || i >= sentences.length) { return; }
        if (mode === 'audio') { seekToWord(sentences[i].firstWord); } else { speakFrom(i, state === 'playing'); }
    }

    button.addEventListener('click', function () {
        if (state === 'playing') { pause(); } else { play(); }
    });

    // Once listening has started, tapping or clicking the text jumps to that spot.
    essay.addEventListener('click', function (event) {
        if (state === 'idle') { return; }
        var target = event.target;
        if (!target || !target.closest || target.closest('a, button')) { return; }
        var selection = window.getSelection ? String(window.getSelection()) : '';
        if (selection.length) { return; }   // the reader is selecting text, not jumping

        var wordSpan = target.closest('.word');
        var sentenceSpan = target.closest('.sentence');
        if (mode === 'audio' && wordSpan) {
            seekToWord(Number(wordSpan.getAttribute('data-word')));
        } else if (sentenceSpan) {
            jumpToSentence(Number(sentenceSpan.getAttribute('data-sentence')));
        }
    });

    // Keyboard equivalent: with the button focused, the left and right arrow
    // keys step back or forward one sentence.
    button.addEventListener('keydown', function (event) {
        if (state === 'idle') { return; }
        var step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) { return; }
        event.preventDefault();
        var from = mode === 'audio' ? Math.max(0, readingSentence) : index;
        jumpToSentence(Math.min(sentences.length - 1, Math.max(0, from + step)));
    });

    ['wheel', 'touchmove', 'keydown'].forEach(function (type) {
        window.addEventListener(type, function () { lastUserScroll = Date.now(); }, { passive: true });
    });

    // Stop when the reader leaves; some browsers otherwise keep talking on the next page.
    window.addEventListener('pagehide', function () {
        if (mode === 'audio') {
            if (audio && !audio.paused) { audio.pause(); }
        } else {
            run += 1;
            synth.cancel();
            if (state === 'playing') { setState('paused'); }
        }
    });

    if (mode === 'speech') {
        hint = HINT_SENTENCE;
        synth.cancel();   // clear anything left queued by a previous page
    } else if (credit) {
        credit.hidden = false;
    }

    essay.setAttribute('data-listen', mode);   // lets the stylesheet tell the two modes apart
    setState('idle');
    button.hidden = false;
}());
