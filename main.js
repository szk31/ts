let cfg_channel_selected = "n";
let cur_vid_id = "";

let cfg_search_songname = true;

const vid_title_lookup = {
	逢魔きらら: "k",
	きらLIVE: "k",
	胡桃澤もも: "m",
	つきみゆこ: "y"
};

const ch_eq_lookup = {
	k: {
		":op:": ":_ぽあよ:",
		":ed:": ":_ぽやしゅみ:"
	},
	m: {
		":op:": ":_konkuru:",
		":ed:": ":_otsukuru:"
	},
	y: {
		":op:": ":_ykon::_yyuco:",
		":ed:": ":_yotsu::_yyuco:"
	}
}

let keybind = {
	forward_5s: ["ArrowRight"],
	forward_10s: ["l"],
	rewind_5s: ["ArrowLeft"],
	rewind_10s: ["j"],
	play_toggle: ["k", " "],
	volume_up: ["ArrowUp"],
	volume_down: ["ArrowDown"],
	volume_mute: ["m"],
	ts_insert: ["Enter"]
}

let ts_input_count = 0;
let song_normalised = [[]];
let auto_note = [];
const auto_max = 10;
let auto_target;

$(document).ready(function() {
	ts_input_add_row();
	for (var i = 1; i < song.length; ++i) {
		song_normalised.push([
			song[i][0].normalize("NFKC").toLowerCase().trim(),
			song[i][1],
			song[i][2]
		]);
		if (i > 2 && song_normalised[i][0] === song_normalised[i - 1][0]) {
			auto_note.push(i - 1);
			auto_note.push(i);
		}
	}
});

$(function() {
	// selecting channel
	$(document).on("click", ".cfg_ch_op", function() {
		$(`.cfg_ch_op`).removeClass("selected");
		$(this).addClass("selected");
		cfg_channel_selected = this.id.replace("cfg_ch_", "");
	});

	// submit video id on pressing enter
	$(document).on("keydown", "#ts_vid_id", function(e) {
		if (e.key === "Enter") {
			$("#ts_vid_id").blur();
		}
	});

	$(document).on("click", "#ts_vid_id", function(e) {
		if (this.value) {
			// select input if not empty
			let pass = this;
			setTimeout(function() {
				pass.setSelectionRange(0, pass.value.length);
			}, 0);
			return;
		}
		navigator.clipboard.readText().then(data => {
			if (data === cur_vid_id) {
				return;
			}
			if (/^[a-zA-Z0-9_-]{11}$/.test(data)) {
				$("#ts_vid_id").val(data).blur();
			}
		}).catch(error => {
			console.error('Failed to read clipboard contents: ', error);
		});
	});

	// video id input
	$(document).on("blur", "#ts_vid_id", function() {
		if (!$(this)[0].checkValidity() ||
			cur_vid_id === this.value
		) {
			return;
		}
		cur_vid_id = this.value;

		// reset if input emptyed
		if (!cur_vid_id) {
			yt_player.destroy();
			$("#cfg_ch_n").click();
			return;
		}
		
		// load video
		yt_load_video(cur_vid_id);
	});

	let keys_down = {};
	// video control
	$(document).on("keydown", "body", function(e) {
		if (!yt_player) {
			return;
		}
		keys_down[e.keyCode] = true;
		if (e.key === "Escape") {
			document.activeElement.blur();
			return;
		}
		if (document.activeElement !== $("body")[0] && keys_down.length !== 1) {
			return;
		}
		let action;
		for (let i in keybind) {
			if (keybind[i].includes(e.key)) {
				action = i;
				break;
			}
		}
		// should check for if yt video is available but
		// not doing does not break anything so nah
		switch (action) {
			case "rewind_10s":
				yt_vid_jump2(yt_player.getCurrentTime() - 10);
				break;
			case "forward_10s":
				yt_vid_jump2(yt_player.getCurrentTime() + 10);
				break;
			case "rewind_5s":
				yt_vid_jump2(yt_player.getCurrentTime() - 5);
				break;
			case "forward_5s":
				yt_vid_jump2(yt_player.getCurrentTime() + 5);
				break;
			case "play_toggle":
				if (yt_player.getPlayerState() === YT.PlayerState.PLAYING) {
					yt_player.pauseVideo();
				} else {
					yt_player.playVideo();
				}
				break;
			case "volume_up":
				yt_player.setVolume(yt_player.getVolume() + 5);
				break;
			case "volume_down":
				yt_player.setVolume(yt_player.getVolume() - 5);
				break;
			case "volume_mute":
				yt_player.isMuted() ? yt_player.unMute() : yt_player.mute();
				break;
			case "ts_insert":
				e.preventDefault();
				ts_input_add_ts(Math.floor(yt_player.getCurrentTime()));
				break;
		}
	});

	$(document).on("keyup", function(e) {
		delete keys_down[e.keyCode];
	});


	$(document).on("click", ".ts_input_delete", function() {
		let this_index = ts_input_get_index(this) + 1;
		if (this_index === 2) {
			return;
		}
		$(`#input>div:nth-child(${this_index})`).remove();
	});

	// timestamp input - time
	$(document).on("keydown", "textarea", function(e) {
		if (e.key !== "Enter") {
			return;
		}
		e.preventDefault();
		$(this).val($(this).val().replace(/\n/g, ""));
		// focus the lower textarea
		if (ts_input_is_last(this)) {
			keys_down[e.keyCode] = true;
			document.activeElement.blur();
		} else {
			let index = ts_input_get_index(this) + 2;
			$(`#input > div:nth-child(${index}) .${$(this).attr("class")}`).focus();
		}
	});

	// Alt.+ L/R arrow -> edit ts & test-play
	$(document).on("keydown", ".ts_input_time", function(e) {
		// check if alt key is down
		if (!keys_down[18]) {
			return;
		}
		let delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
		if (!delta) {
			return;
		}
		let time = ts_to_second(this.value) + delta;
		$(this).val(sec_to_hmmss(time));
		yt_vid_jump2(time);
	})

	$(document).on("input", ".ts_input_time", function() {
		update_output();
	});

	$(document).on("blur", ".ts_input_time", function() {
		// normalise
		let input = this.value;
		if (!input) {
			return;
		}
		if (input.split(":").length === 1) {
			this.value = sec_to_hmmss(parseInt(input));
		}

		//update
		update_output();
	});



	// timestamp input - context
	// record of 1.2em, 2.4em, someway hardcoded
	let ic_em_lookup = [];
	$(document).on("input", ".ts_input_cntx", function() {
		// remove class to test true height
		$(this).removeClass("multiple_lines");
		// get true height
		let outer = this.scrollHeight;
		if (!ic_em_lookup.includes(outer)) {
			ic_em_lookup.push(outer);
			ic_em_lookup.sort((a, b) => a - b);
		}
		// apply class when needed (true height being 2 lines)
		if (outer === ic_em_lookup[1]) {
			$(this).addClass("multiple_lines");
		}
		if (cfg_search_songname) {
			auto_target = this;
			auto_search();
		}
		update_output();
	});

	$(document).on("click", "#ts_input_new_row", function() {
		ts_input_add_row();
	});

	$(document).on("click", "#autoback", function() {
		if ($(this).hasClass("auto_name")) {
			return;
		}
		$(".auto").addClass("hidden");
	});

	$(document).on("click", ".auto_name", function() {
		const id = parseInt(this.id.replace("auto_", ""));
		auto_target.value = song[id][0];
		$(".auto").addClass("hidden");
		update_output();
	});

	$(document).on("click", "#ts_output_copy", function() {
		const text = $("#output").html().replaceAll("<br>", "\n");
		navigator.clipboard.writeText(text);
		console.log(text);
	})
});

function auto_search() {
	$(this).removeClass("auto_ed");
	const input = auto_target.value.normalize("NFKC").toLowerCase().trim();
	if (!input) {
		$("#autosearch").addClass("hidden");
		return;
	}
	let h_s = [], h_m = [];
	for (let i = 1; i < song_normalised.length; ++i) {
		// from start
		let name_pos = song_normalised[i][0].indexOf(input),
			read_pos = song_normalised[i][2].indexOf(input);
		if (!name_pos || !read_pos) {
			h_s.push(i);
		} else 
		if (name_pos > 0 || read_pos > 0) {
			h_m.push(i);
		}
		if (h_s.length >= auto_max) {
			break;
		}
	}
	let hits = h_s.concat(h_m).slice(0, auto_max);
	let new_html = "";
	for (var i in hits) {
		new_html += `<div id="auto_${hits[i]}" class="auto_name">${song[hits[i]][0].trim()}${auto_note.includes(hits[i]) ? ` / ${song[hits[i]][1]}`: ""}</div>`;
	}
	$("#autosearch").html(new_html);
	$(".auto").removeClass("hidden");

	// set autosearch position
	const coord = auto_target.getBoundingClientRect();
	$("#autosearch").attr("style", `left:${coord.left}px;top:${coord.bottom + window.scrollY}px;width:${coord.right - coord.left}px`);
}

function update_output() {
	let new_html = `タイムスタンプ<br>*敬称略<br><br>`;
	const all_textarea = $("textarea").splice(2);
	let lever = true;
	for (let i = 0; i < all_textarea.length; ++i) {
		let e = all_textarea[i].value;
		if (lever) {
			new_html += e ? e : "0:00:00";
		} else {
			let id;
			for (let j = 1; j < song.length; ++j) {
				if (song[j][0] === e) {
					id = j;
					break;
				}
			}
			// check for registered stamp if no song hit
			if (!id && cfg_channel_selected !== "n") {
				for (let j in ch_eq_lookup[cfg_channel_selected]) {
					if (e === j) {
						e = ch_eq_lookup[cfg_channel_selected][j];
						break;
					}
				}
			}
			new_html += ` ${e}${id ? ` / ${song[id][1]}` : ""}<br>`;
		}
		lever ^= 1;
	}
	$("#output").html(new_html);
}





let yt_player;

function yt_load_video(vid_id) {
	if (yt_player) {
		yt_player.destroy();
	}
	yt_player = new YT.Player("vid_player", {
		height: "360",
		width: "640",
		videoId: vid_id,
		events: {
			"onReady": yt_vid_ready
		}
	});
}

function yt_vid_ready() {
	yt_player.playVideo();
	let vid_title = $("iframe")[0].title;
	for (let i in vid_title_lookup) {
		if (vid_title.includes(i)) {
			cfg_channel_selected = vid_title_lookup[i];
			$("#cfg_ch_" + cfg_channel_selected).click();
		}
	}
}

function yt_vid_jump2(second) {
	yt_player.seekTo(second, true);
}

function ts_input_add_row() {
	$("#input").append($("#ts_input_template").clone().attr("id", "").attr("class", "input_item"));
	ts_input_count++;
}

// 0th element is template, thus start from 1
function ts_input_get_index(node) {
	let e = $(node).closest(".input_item");
	return Array.from(e.parent()[0].children).indexOf(e[0]);
}

function ts_input_is_last(node) {
	return ts_input_get_index(node) === ts_input_count;
}

function ts_input_add_ts(timestamp) {
	// get timestamp and try to add to ts input
	console.log(timestamp);
	ts_input_add_row();
	$(`#input > div:last-child .ts_input_time`).val(sec_to_hmmss(timestamp));
	$(`#input > div:last-child .ts_input_cntx`).focus();
}


function sec_to_hmmss(input) {
	return `${Math.floor(input / 3600)}:${zero_pad(Math.floor((input % 3600) / 60), 2)}:${zero_pad(input % 60, 2)}`;
}

function ts_to_second(input) {
	const hms = input.split(":");
	return parseInt(hms[0]) * 3600 + parseInt(hms[1]) * 60 + parseInt(hms[2]);
}

function zero_pad(number, length) {
	return number.toString().padStart(length, "0");
}

/**
 * to do
 * 
 * 1. youtube control keybind customisation
 * 2. auto-search keybpard control
 * 3. cfg_in: toggle: do search for song name
 * 
 */