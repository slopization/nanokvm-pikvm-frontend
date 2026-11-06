"use strict";

import {tools, $} from "../tools.js";
import {wm} from "../wm.js";

export function Nanokvm() {
	let pairingTimer = null;

	const request = async function(path, options={}) {
		const response = await fetch(path, {
			...options,
			headers: {"Content-Type": "application/json", ...(options.headers || {})},
		});
		const body = await response.json().catch(() => ({message: response.statusText}));
		if (!response.ok) throw new Error(body.message || response.statusText);
		return body;
	};

	const number = id => Number($(id).value);
	const optionalNumber = id => ($(id).value === "" ? null : number(id));

	const loadSettings = async function() {
		const value = await request("/api/settings/sections");
		const web = value.web;
		const moonlight = value.moonlight;
		$("nanokvm-usb-audio-class").value = value.usb_audio_class;

		$("nanokvm-web-audio").value = web.audio;
		$("nanokvm-web-opus-rate").value = web.opus_bitrate_kbps;
		$("nanokvm-web-opus-complexity").value = web.opus_complexity;
		$("nanokvm-web-width").value = web.capture_width;
		$("nanokvm-web-height").value = web.capture_height;
		$("nanokvm-web-fps").value = web.advertised_fps;
		$("nanokvm-web-divider").value = web.frame_divider;
		$("nanokvm-web-bitrate").value = web.bitrate_kbps ?? "";
		$("nanokvm-web-gop").value = web.gop;
		$("nanokvm-web-loop-filter").value = web.hevc_loop_filter ?? "";
		$("nanokvm-web-seek").checked = web.seek;
		$("nanokvm-web-wavefront").checked = web.wavefront;
		$("nanokvm-web-repeat-headers").checked = web.repeat_headers;
		$("nanokvm-web-aud").checked = web.aud;

		$("nanokvm-name").value = moonlight.name;
		$("nanokvm-codec").value = moonlight.codec;
		$("nanokvm-encryption").value = moonlight.encryption_mode;
		$("nanokvm-audio").value = moonlight.audio;
		$("nanokvm-opus-rate").value = moonlight.opus_bitrate_kbps;
		$("nanokvm-opus-complexity").value = moonlight.opus_complexity;
		$("nanokvm-width").value = moonlight.capture_width;
		$("nanokvm-height").value = moonlight.capture_height;
		$("nanokvm-fps").value = moonlight.advertised_fps;
		$("nanokvm-divider").value = moonlight.frame_divider;
		$("nanokvm-bitrate").value = moonlight.bitrate_kbps ?? "";
		$("nanokvm-gop").value = moonlight.gop;
		$("nanokvm-fec").value = moonlight.video_fec_percentage;
		$("nanokvm-parity").value = moonlight.video_min_parity_shards;
		$("nanokvm-loop-filter").value = moonlight.hevc_loop_filter ?? "";
		$("nanokvm-wavefront").checked = moonlight.wavefront;
		$("nanokvm-repeat-headers").checked = moonlight.repeat_headers;
		$("nanokvm-aud").checked = moonlight.aud;
	};

	const collectWeb = () => ({
		codec: "hevc",
		audio: $("nanokvm-web-audio").value,
		opus_bitrate_kbps: number("nanokvm-web-opus-rate"),
		opus_complexity: number("nanokvm-web-opus-complexity"),
		capture_width: number("nanokvm-web-width"),
		capture_height: number("nanokvm-web-height"),
		advertised_fps: number("nanokvm-web-fps"),
		frame_divider: number("nanokvm-web-divider"),
		bitrate_kbps: optionalNumber("nanokvm-web-bitrate"),
		gop: number("nanokvm-web-gop"),
		hevc_loop_filter: optionalNumber("nanokvm-web-loop-filter"),
		seek: $("nanokvm-web-seek").checked,
		wavefront: $("nanokvm-web-wavefront").checked,
		repeat_headers: $("nanokvm-web-repeat-headers").checked,
		aud: $("nanokvm-web-aud").checked,
	});

	const collectMoonlight = () => ({
		name: $("nanokvm-name").value,
		codec: $("nanokvm-codec").value,
		audio: $("nanokvm-audio").value,
		opus_bitrate_kbps: number("nanokvm-opus-rate"),
		opus_complexity: number("nanokvm-opus-complexity"),
		capture_width: number("nanokvm-width"),
		capture_height: number("nanokvm-height"),
		advertised_fps: number("nanokvm-fps"),
		frame_divider: number("nanokvm-divider"),
		bitrate_kbps: optionalNumber("nanokvm-bitrate"),
		gop: number("nanokvm-gop"),
		video_fec_percentage: number("nanokvm-fec"),
		video_min_parity_shards: number("nanokvm-parity"),
		encryption_mode: $("nanokvm-encryption").value,
		hevc_loop_filter: optionalNumber("nanokvm-loop-filter"),
		wavefront: $("nanokvm-wavefront").checked,
		repeat_headers: $("nanokvm-repeat-headers").checked,
		aud: $("nanokvm-aud").checked,
	});

	const saveSettings = async function(section) {
		const button = $(`nanokvm-save-${section}`);
		const status = $(`nanokvm-${section}-save-status`);
		tools.el.setEnabled(button, false);
		status.textContent = "Saving";
		try {
			const value = await request("/api/settings/sections");
			value.usb_audio_class = $("nanokvm-usb-audio-class").value;
			value[section] = section === "web" ? collectWeb() : collectMoonlight();
			const result = await request("/api/settings/sections", {
				method: "PUT",
				body: JSON.stringify(value),
			});
			status.textContent = result.message;
			if (result.message.includes("USB reconnecting")) {
				setTimeout(() => tools.currentOpen("login"), 2000);
			}
		} catch (error) {
			status.textContent = error.message;
		} finally {
			tools.el.setEnabled(button, true);
		}
	};

	const deviceInfo = function(device) {
		const info = document.createElement("div");
		const name = document.createElement("div");
		name.className = "nanokvm-device-name";
		name.textContent = device.display_name || "Moonlight client";
		const id = document.createElement("div");
		id.className = "nanokvm-device-id";
		id.textContent = device.client_id;
		info.append(name, id);
		return info;
	};

	const actionButton = function(label, action) {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = label;
		button.onclick = action;
		return button;
	};

	const pendingDevice = function(device) {
		const row = document.createElement("div");
		row.className = "nanokvm-device";
		row.dataset.clientId = device.client_id;
		const actions = document.createElement("div");
		actions.className = "nanokvm-device-actions";
		const pin = document.createElement("input");
		pin.inputMode = "numeric";
		pin.maxLength = 4;
		pin.placeholder = "PIN";
		pin.setAttribute("aria-label", "Moonlight PIN");
		actions.append(
			pin,
			actionButton("Pair", async function() {
				try {
					await request(`/api/pairing/${encodeURIComponent(device.client_id)}`, {
						method: "POST",
						body: JSON.stringify({pin: pin.value}),
					});
					await loadDevices();
				} catch (error) {
					wm.error("Pairing failed", error.message);
				}
			}),
			actionButton("Reject", async function() {
				await request(`/api/pairing/${encodeURIComponent(device.client_id)}`, {method: "DELETE"});
				await loadDevices();
			}),
		);
		row.append(deviceInfo(device), actions);
		return row;
	};

	const pairedDevice = function(device) {
		const row = document.createElement("div");
		row.className = "nanokvm-device";
		row.dataset.clientId = device.client_id;
		row.append(deviceInfo(device), actionButton("Remove", async function() {
			if (!await wm.confirm("Remove this Moonlight device?")) return;
			await request(`/api/pairing/${encodeURIComponent(device.client_id)}`, {method: "DELETE"});
			await loadDevices();
		}));
		return row;
	};

	const renderDevices = function(target, devices, create) {
		const values = new Map();
		for (const row of target.querySelectorAll(".nanokvm-device")) {
			const input = row.querySelector("input");
			if (input) values.set(row.dataset.clientId, input.value);
		}
		const focusedRow = document.activeElement?.closest?.(".nanokvm-device");
		const focusedClientId = focusedRow?.dataset.clientId;
		const selectionStart = document.activeElement?.selectionStart;
		const selectionEnd = document.activeElement?.selectionEnd;
		target.replaceChildren();
		if (devices.length === 0) {
			const empty = document.createElement("div");
			empty.className = "nanokvm-empty";
			empty.textContent = "None";
			target.append(empty);
			return;
		}
		for (const device of devices) {
			const row = create(device);
			const input = row.querySelector("input");
			if (input && values.has(device.client_id)) input.value = values.get(device.client_id);
			target.append(row);
			if (input && device.client_id === focusedClientId) {
				input.focus();
				if (selectionStart !== undefined && selectionEnd !== undefined) {
					input.setSelectionRange(selectionStart, selectionEnd);
				}
			}
		}
	};

	const loadDevices = async function() {
		const devices = await request("/api/pairing");
		renderDevices($("nanokvm-pending-devices"), devices.pending, pendingDevice);
		renderDevices($("nanokvm-paired-devices"), devices.paired, pairedDevice);
	};

	tools.el.setOnClick($("nanokvm-save-web"), () => saveSettings("web"));
	tools.el.setOnClick($("nanokvm-save-moonlight"), () => saveSettings("moonlight"));
	tools.el.setOnClick($("nanokvm-change-password"), async function() {
		try {
			await request("/api/password/change", {
				method: "POST",
				body: JSON.stringify({
					current_password: $("nanokvm-current-password").value,
					new_password: $("nanokvm-new-password").value,
				}),
			});
			tools.currentOpen("login");
		} catch (error) {
			wm.error("Password change failed", error.message);
		}
	});
	tools.el.setOnClick($("nanokvm-logout"), async function() {
		await request("/api/auth/logout", {method: "POST"});
		tools.currentOpen("login");
	});
	tools.el.setOnClick($("nanokvm-reboot"), async function() {
		if (!await wm.confirm("Reboot the KVM now?")) return;
		await request("/api/system/reboot", {method: "POST"});
		tools.el.setEnabled($("nanokvm-reboot"), false);
	});

	Promise.all([loadSettings(), loadDevices()]).catch(error => wm.error("NanoKVM settings failed", error.message));
	pairingTimer = setInterval(() => {
		if (!$("nanokvm-window").classList.contains("hidden")) loadDevices().catch(() => {});
	}, 2000);
	window.addEventListener("beforeunload", () => clearInterval(pairingTimer), {once: true});
}
