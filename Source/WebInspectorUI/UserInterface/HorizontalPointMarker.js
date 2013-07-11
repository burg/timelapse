/*
 *  Copyright (C) 2013, University of Washington. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of the University of Washington nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

WebInspector.HorizontalPointMarker = function(containingElement)
{
    WebInspector.Object.call(this);
    this.element = document.createElement("div");
    this.element.classList.add(WebInspector.HorizontalPointMarker.StyleClassName);

    // These listeners must be set up before adjustable is initialized,
    // because it may want to install drag listeners immediately.
    this._dragListeners = new WebInspector.EventListenerGroup(this, "Drag-related listeners for HorizontalPointMarker");
    this._dragListeners.register(this.element, "dragstart", this._dragStarted);
    this._dragListeners.register(this.element, "drag", this._markerDragging);
    this._dragListeners.register(this.element, "dragend", this._dragEnded);

    this._dropListeners = new WebInspector.EventListenerGroup(this, "Drop-related listeners for marker's containing element");
    this._dropListeners.register(containingElement, "dragenter", this._dragEnteredContainingElement);
    this._dropListeners.register(containingElement, "dragover", this._draggedOverContainingElement);
    this._dropListeners.register(containingElement, "drop", this._markerDropped);

    this._animateFrameCallback = this.animateFrame.bind(this);

    this.adjustable = WebInspector.HorizontalPointMarker.DefaultAdjustableSetting;
    this.visible = WebInspector.HorizontalPointMarker.DefaultVisibleSetting;
    this.enabled = WebInspector.HorizontalPointMarker.DefaultEnabledSetting;
};

WebInspector.HorizontalPointMarker.Event = {
    DragEnd: "horizontal-point-marker-drag-end",
    DragStart: "horizontal-point-marker-drag-start",
    Moved: "horizontal-point-marker-moved"
};

WebInspector.HorizontalPointMarker.DefaultAdjustableSetting = false;
WebInspector.HorizontalPointMarker.DefaultVisibleSetting = true;
WebInspector.HorizontalPointMarker.DefaultEnabledSetting = true;

WebInspector.HorizontalPointMarker.StyleClassName = "horizontal-point-marker";
WebInspector.HorizontalPointMarker.DraggingStyleClassName = "horizontal-point-marker-dragging";
WebInspector.HorizontalPointMarker.AdjustableStyleClassName = "adjustable";
WebInspector.HorizontalPointMarker.HiddenStyleClassName = "hidden";
WebInspector.HorizontalPointMarker.DisabledStyleClassName = "disabled";


WebInspector.HorizontalPointMarker.prototype = {
    constructor: WebInspector.HorizontalPointMarker,
    __proto__: WebInspector.Object.prototype,

    // Public

    shown: function()
    {
    },

    closed: function()
    {
    },

    updateLayout: function()
    {
    },

    refreshSoon: function()
    {
        if (this._haveEnqueuedAnimationRequest)
            return;

        this._haveEnqueuedAnimationRequest = true;
        window.requestAnimationFrame(this._animateFrameCallback);
    },

    animateTo: function(position, duration)
    {
        this._currentAnimation = {
            "startPosition": this.position,
            "targetPosition": position,
            "duration": duration, // in seconds
            "startTime": Date.now(),
        };

        this.refreshSoon();
    },

    animateFrame: function(animationRequestId)
    {
        if (this._haveEnqueuedAnimationRequest && animationRequestId)
            window.cancelAnimationFrame(animationRequestId);

        this._haveEnqueuedAnimationRequest = false;

        if (this.element.parentElement === null)
            return;

        // if an animation is in progress, then interpolate a new value for position.
        if (this._currentAnimation) {
            var elapsedSeconds = (Date.now() - this._currentAnimation.startTime) / 1000.0;
            if (elapsedSeconds > this._currentAnimation.duration) {
                this.position = this._currentAnimation.targetPosition;
                delete this._currentAnimation;
            } else {
                var elapsedPercent = elapsedSeconds / this._currentAnimation.duration;
                var positionRange = this._currentAnimation.targetPosition - this._currentAnimation.startPosition;
                var interpolatedPosition = this._currentAnimation.startPosition + (positionRange * elapsedPercent);
                this.setPosition(interpolatedPosition, true, true);
            }
        }

        var parentWidth = this.element.parentElement.clientWidth;
        // subtract slider width when computing largest possible (left) position. If the width is
        // not explicitly set, assume this marker has a dynamic width and don't substract any width.
        // FIXME: this is broken. it will be fixed when HorizontalRangeMarker is split from this class.
        var unavailablePercent = (this.element.style.width !== "") ? this.element.offsetWidth / parentWidth : 0.0;
        this.element.style.left = (Number.constrain(this.position, 0.0, 1.0) - unavailablePercent) * 100.0 + "%";

        if (this._currentAnimation)
            this.refreshSoon();
    },

    get position()
    {
        return this._position;
    },

    set position(pos)
    {
        this.setPosition(pos);
    },

    setPosition: function(percent, suppressEvents)
    {
        this._position = Number.constrain(percent, 0.0, 1.0);
        this.refreshSoon();
        if (!suppressEvents)
            this.dispatchEventToListeners(WebInspector.HorizontalPointMarker.Event.Moved);
    },

    get adjustable()
    {
        return this._adjustable;
    },

    set adjustable(value)
    {
        if (value === this._adjustable)
            return;

        this._adjustable = value;

        if (value) {
            this.element.classList.add(WebInspector.HorizontalPointMarker.AdjustableStyleClassName);
            this._dragListeners.install();
        } else {
            this.element.classList.remove(WebInspector.HorizontalPointMarker.AdjustableStyleClassName);
            if (this._dragListeners.installed)
                this._dragListeners.uninstall();
        }
    },

    get visible()
    {
        return this._visible;
    },

    set visible(value)
    {
        this._visible = !!value;
        if (value)
            this.element.classList.remove(WebInspector.HorizontalPointMarker.HiddenStyleClassName);
        else
            this.element.classList.add(WebInspector.HorizontalPointMarker.HiddenStyleClassName);
    },

    get enabled()
    {
        return this._enabled;
    },

    set enabled(value)
    {
        this._enabled = !!value;
        if (value)
            this.element.classList.remove(WebInspector.HorizontalPointMarker.DisabledStyleClassName);
        else
            this.element.classList.add(WebInspector.HorizontalPointMarker.DisabledStyleClassName);
    },

    // Private

    _dragStarted: function(event)
    {
        event.dataTransfer.effectAllowed = "none";
        this.element.parentElement.classList.add(WebInspector.HorizontalPointMarker.DraggingStyleClassName);
        this.dispatchEventToListeners(WebInspector.HorizontalPointMarker.Event.DragStart, event);
        this._dropListeners.install();
    },

    _markerDropped: function(event)
    {
        // This signals that the event target accepted the drop.
        event.stopPropagation();
    },

    _dragEnteredContainingElement: function(event)
    {
        // This signals that the event target is an acceptable drop target for the dragged item.
        event.preventDefault();
        return true;
    },

    _draggedOverContainingElement: function(event)
    {
        // This signals that the event target is an acceptable drop target for the dragged item.
        event.preventDefault();
        return true;
    },

    _dragEnded: function(event)
    {
        this.element.parentElement.classList.remove(WebInspector.HorizontalPointMarker.DraggingStyleClassName);
        this.dispatchEventToListeners(WebInspector.HorizontalPointMarker.Event.DragEnd, event);
        this._dropListeners.uninstall();
   },

    _markerDragging: function(event)
    {
        var parent = this.element.parentElement;
        var dragOffsetX = event.clientX - parent.totalOffsetLeft - (this.element.offsetWidth / 2);
        var minimumX = parent.clientLeft;
        var maximumX = minimumX + parent.clientWidth - this.element.offsetWidth;
        dragOffsetX = Number.constrain(dragOffsetX, minimumX, maximumX - this.element.offsetWidth);
        this.position = dragOffsetX / (maximumX - minimumX);
    }
};
