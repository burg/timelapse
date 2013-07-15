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

WebInspector.HorizontalRangeMarker = function(containingElement)
{
    WebInspector.Object.call(this);
    this.element = document.createElement("div");
    this.element.classList.add(WebInspector.HorizontalRangeMarker.StyleClassName);

    // These listeners must be set up before adjustable is initialized,
    // because it may want to install drag listeners immediately.
    this._dragListeners = new WebInspector.EventListenerGroup(this, "Drag-related listeners for HorizontalRangeMarker");
    this._dragListeners.register(this.element, "dragstart", this._dragStarted);
    this._dragListeners.register(this.element, "drag", this._markerDragging);
    this._dragListeners.register(this.element, "dragend", this._dragEnded);

    this._dropListeners = new WebInspector.EventListenerGroup(this, "Drop-related listeners for marker's containing element");
    this._dropListeners.register(containingElement, "dragenter", this._dragEnteredContainingElement);
    this._dropListeners.register(containingElement, "dragover", this._draggedOverContainingElement);
    this._dropListeners.register(containingElement, "drop", this._markerDropped);

    this._animateFrameCallback = this.animateFrame.bind(this);

    this.adjustable = WebInspector.HorizontalRangeMarker.DefaultAdjustableSetting;
    this.visible = WebInspector.HorizontalRangeMarker.DefaultVisibleSetting;
    this.enabled = WebInspector.HorizontalRangeMarker.DefaultEnabledSetting;
    this.setRange(WebInspector.HorizontalRangeMarker.DefaultRangeLeft, WebInspector.HorizontalRangeMarker.DefaultRangeRight);
};

WebInspector.HorizontalRangeMarker.Event = {
    Changed: "horizontal-range-marker-changed",
    DragEnd: "horizontal-range-marker-drag-end",
    DragStart: "horizontal-range-marker-drag-start",
    Dragging: "horizontal-range-marker-dragging"
};

WebInspector.HorizontalRangeMarker.DefaultAdjustableSetting = false;
WebInspector.HorizontalRangeMarker.DefaultVisibleSetting = true;
WebInspector.HorizontalRangeMarker.DefaultEnabledSetting = true;
WebInspector.HorizontalRangeMarker.DefaultRangeLeft = 0.0;
WebInspector.HorizontalRangeMarker.DefaultRangeRight = 1.0;

WebInspector.HorizontalRangeMarker.StyleClassName = "horizontal-range-marker";
WebInspector.HorizontalRangeMarker.DraggingStyleClassName = "horizontal-range-marker-dragging";
WebInspector.HorizontalRangeMarker.AdjustableStyleClassName = "adjustable";
WebInspector.HorizontalRangeMarker.HiddenStyleClassName = "hidden";
WebInspector.HorizontalRangeMarker.DisabledStyleClassName = "disabled";


WebInspector.HorizontalRangeMarker.prototype = {
    constructor: WebInspector.HorizontalRangeMarker,
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

    animateTo: function(left, right, duration)
    {
        this._currentAnimation = {
            "startLeft": this.left,
            "finishLeft": left,
            "startRight": this.right,
            "finishRight": right,
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
                this.setRange(this._currentAnimation.finishLeft, this._currentAnimation.finishRight);
                delete this._currentAnimation;
            } else {
                var elapsedPercent = elapsedSeconds / this._currentAnimation.duration;
                var leftDelta = this._currentAnimation.finishLeft - this._currentAnimation.startLeft;
                var rightDelta = this._currentAnimation.finishRight - this._currentAnimation.startRight;
                var interpolatedLeft = this._currentAnimation.startLeft + (leftDelta * elapsedPercent);
                var interpolatedRight = this._currentAnimation.startRight + (rightDelta * elapsedPercent);
                this.setRange(interpolatedLeft, interpolatedRight, true);
            }
        }

        this.element.style.left = Number.constrain(this.left, 0.0, 1.0) * 100.0 + "%";
        // Convert position coordinates from percent-from-left to percent-from-right.
        this.element.style.right = Number.constrain(1.0 - this.right, 0.0, 1.0) * 100.0 + "%";

        if (this._currentAnimation)
            this.refreshSoon();
    },

    get left()
    {
        return this._left;
    },

    set left(pos)
    {
        this.setRange(pos, this.right);
    },

    get right()
    {
        return this._right;
    },

    set right(pos)
    {
        this.setRange(this.left, pos);
    },

    setRange: function(left, right, suppressEvents)
    {
        if (left === this.left && right === this.right)
            return;

        this._left = Number.constrain(left, 0.0, 1.0);
        this._right = Number.constrain(right, 0.0, 1.0);

        this.refreshSoon();
        if (!suppressEvents)
            this.dispatchEventToListeners(WebInspector.HorizontalRangeMarker.Event.Changed);
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
            this.element.classList.add(WebInspector.HorizontalRangeMarker.AdjustableStyleClassName);
            this._dragListeners.install();
        } else {
            this.element.classList.remove(WebInspector.HorizontalRangeMarker.AdjustableStyleClassName);
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
            this.element.classList.remove(WebInspector.HorizontalRangeMarker.HiddenStyleClassName);
        else
            this.element.classList.add(WebInspector.HorizontalRangeMarker.HiddenStyleClassName);
    },

    get enabled()
    {
        return this._enabled;
    },

    set enabled(value)
    {
        this._enabled = !!value;
        if (value)
            this.element.classList.remove(WebInspector.HorizontalRangeMarker.DisabledStyleClassName);
        else
            this.element.classList.add(WebInspector.HorizontalRangeMarker.DisabledStyleClassName);
    },

    // Private

    _computeDragPosition: function(event)
    {
        var parent = this.element.parentElement;
        var dragOffsetX = event.clientX - parent.totalOffsetLeft;
        return dragOffsetX / parent.clientWidth;
    },

    _dragStarted: function(event)
    {
        event.dataTransfer.effectAllowed = "none";
        var dragPosition = this._computeDragPosition(event);
        var data = {
            event: event,
            dragPosition: dragPosition
        };
        this.dispatchEventToListeners(WebInspector.HorizontalRangeMarker.Event.DragStart, data);
        this._dropListeners.install();
        this._dragData = {
            initialLeft: this.left,
            initialRight: this.right,
            initialDragPosition: dragPosition
        };

        // This is necessary to avoid background flickering caused by newly-matched CSS selectors.
        window.requestAnimationFrame(function() {
            this.element.parentElement.classList.add(WebInspector.HorizontalRangeMarker.DraggingStyleClassName);
        }.bind(this));
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
        this.element.parentElement.classList.remove(WebInspector.HorizontalRangeMarker.DraggingStyleClassName);
        this.dispatchEventToListeners(WebInspector.HorizontalRangeMarker.Event.DragEnd, event);
        this._dropListeners.uninstall();
        delete this._dragData;
   },

    _markerDragging: function(event)
    {
        var data = {
            event: event,
            initialLeft: this._dragData.initialLeft,
            initialRight: this._dragData.initialRight,
            initialDragPosition: this._dragData.initialDragPosition,
            dragPosition: this._computeDragPosition(event)
        };
        this.dispatchEventToListeners(WebInspector.HorizontalRangeMarker.Event.Dragging, data);
    }
};
