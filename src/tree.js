const Events = require('eventemitter3')
const clicked = require('clicked')

const defaults = require('./defaults')
const utils = require('./utils')
const icons = require('./icons')

class Tree extends Events
{
    /**
     * Create Tree
     * @param {HTMLElement} element
     * @param {TreeData} tree - data for tree
     * @param {TreeOptions} [options]
     * @param {string} [options.children=children] name of tree parameter containing the children
     * @param {string} [options.parent=parent] name of tree parameter containing the parent link
     * @param {number} [options.indentation=15] number of pixels to indent for each level
     * @param {number} [options.threshold=10] number of pixels to move to start a drag
     * @param {number} [options.holdTime=2000] number of milliseconds before name can be edited (set to 0 to disable)
     * @param {boolean} [options.expandOnClick=true] expand and collapse node on click without drag
     * @param {string[]} [options.nameStyles]
     * @param {string[]} [options.indicatorStyles]
     */
    constructor(element, tree, options)
    {
        super()
        this.options = utils.options(options, defaults)
        this.element = element
        document.body.addEventListener('mousemove', (e) => this._move(e))
        document.body.addEventListener('touchmove', (e) => this._move(e))
        document.body.addEventListener('mouseup', (e) => this._up(e))
        document.body.addEventListener('touchend', (e) => this._up(e))
        document.body.addEventListener('mouseleave', (e) => this._up(e))
        this.tree = tree
        this._createIndicator()
        this.update()
    }

    _createIndicator()
    {
        this.indicator = utils.html()
        const content = utils.html({ parent: this.indicator, styles: { display: 'flex' } })
        this.indicator.indentation = utils.html({ parent: content })
        this.indicator.line = utils.html({
            parent: content,
            defaultStyles: this.options.nameStyles,
            styles: this.options.indicatorStyles
        })
    }

    leaf(data, level)
    {
        const leaf = utils.html()
        leaf.data = data
        const content = utils.html({ parent: leaf, styles: { display: 'flex', alignItems: 'center' } })
        leaf.indentation = utils.html({ parent: content, styles: { width: level * this.options.indentation + 'px' } })
        leaf.icon = utils.html({ parent: content, html: data[this.options.expanded] ? icons.open : icons.closed, styles: this.options.expandStyles })
        leaf.name = utils.html({ parent: content, html: data[this.options.name], styles: this.options.nameStyles })
        leaf.descendents = []

        leaf.name.addEventListener('mousedown', (e) => this._down(e))
        leaf.name.addEventListener('touchstart', (e) => this._down(e))
        for (let child of data[this.options.children])
        {
            const add = this.leaf(child, level + 1)
            leaf.appendChild(add)
            leaf.descendents.push(add)
            if (!data[this.options.expanded])
            {
                add.style.display = 'none'
            }
        }
        if (leaf.descendents.length === 0)
        {
            this._hideIcon(leaf)
        }
        clicked(leaf.icon, () => this.toggleExpand(leaf))
        return leaf
    }

    _hideIcon(leaf)
    {
        leaf.icon.style.opacity = 0
        leaf.icon.style.cursor = 'unset'
    }

    _showIcon(leaf)
    {
        leaf.icon.style.opacity = 1
        leaf.icon.style.cursor = this.options.expandStyles.cursor
    }

    expandAll()
    {
        this._expandChildren(this)
    }

    _expandChildren(leaf)
    {
        for (let child of leaf.descendents)
        {
            this.expand(child)
            this._expandChildren(child)
        }
    }

    collapseAll()
    {
        this._collapseChildren(this)
    }

    _collapseChildren(leaf)
    {
        for (let child of leaf.descendents)
        {
            this.collapse(child)
            this._collapseChildren(child)
        }
    }

    toggleExpand(leaf)
    {
        if (leaf.icon.style.opacity !== '0')
        {
            if (leaf.data[this.options.expanded])
            {
                this.collapse(leaf)
            }
            else
            {
                this.expand(leaf)
            }
        }
    }

    expand(leaf)
    {
        if (leaf.descendents.length)
        {
            this.emit('expand', leaf, this)
            for (let child of leaf.descendents)
            {
                child.style.display = 'block'
            }
            leaf.data[this.options.expanded] = true
            leaf.icon.innerHTML = icons.open
        }
    }

    collapse(leaf)
    {
        if (leaf.descendents.length)
        {
            this.emit('collapse', leaf, this)
            for (let child of leaf.descendents)
            {
                child.style.display = 'none'
            }
            leaf.data[this.options.expanded] = false
            leaf.icon.innerHTML = icons.closed
        }
    }

    /**
     * call this after tree's data has been updated outside of this library
     */
    update()
    {
        const scroll = this.element.scrollTop
        utils.removeChildren(this.element)
        this.descendents = []
        for (let leaf of this.tree[this.options.children])
        {
            const add = this.leaf(leaf, 0)
            this.element.appendChild(add)
            this.descendents.push(add)
        }
        this.element.scrollTop = scroll + 'px'
    }

    _down(e)
    {
        this.target = e.currentTarget.parentNode.parentNode
        this.down = { x: e.pageX, y: e.pageY }
        const pos = utils.toGlobal(this.target)
        this.offset = { x: e.pageX - pos.x, y: e.pageY - pos.y }
        if (this.options.holdTime)
        {
            this.holdTimeout = window.setTimeout(() => this._hold(), this.options.holdTime)
        }
        e.preventDefault()
        e.stopPropagation()
    }

    _hold()
    {
        this.holdTimeout = null
        this.edit = this.target
        this.input = utils.html({ parent: this.edit.name.parentNode, type: 'input', styles: this.options.nameStyles })
        const computed = window.getComputedStyle(this.edit.name)
        this.input.style.boxSizing = 'content-box'
        this.input.style.fontFamily = computed.getPropertyValue('font-family')
        this.input.style.fontSize = computed.getPropertyValue('font-size')
        this.input.value = this.edit.name.innerText
        this.input.setSelectionRange(0, this.input.value.length)
        this.input.focus()
        this.input.addEventListener('change', () =>
        {
            this.nameChange(this.edit, this.input.value)
            this._holdClose()
        })
        this.input.addEventListener('keyup', (e) =>
        {
            if (e.code === 'Escape')
            {
                this._holdClose()
            }
            if (e.code === 'Enter')
            {
                this.nameChange(this.edit, this.input.value)
                this._holdClose()
            }
        })
        this.edit.name.style.display = 'none'
        this.target = null
    }

    _holdClose()
    {
        if (this.edit)
        {
            this.input.remove()
            this.edit.name.style.display = 'block'
            this.edit = this.input = null
        }
    }

    nameChange(leaf, name)
    {
        leaf.data.name = this.input.value
        leaf.name.innerHTML = name
        this.emit('name-change', this.edit, this.input.value, this)
    }

    _setIndicator(parent)
    {
        this.indicator.style.width = parent.name.offsetWidth + 'px'
        this.indicator.indentation.style.width = parent.indentation.offsetWidth + 'px'
        this.target.parentNode.insertBefore(this.indicator, parent)
    }

    _pickup()
    {
        if (this.holdTimeout)
        {
            window.clearTimeout(this.holdTimeout)
            this.holdTimeout = null
        }
        this._setIndicator(this.target)
        this.target.parentNode.insertBefore(this.indicator, this.target)
        const pos = utils.toGlobal(this.target)
        document.body.appendChild(this.target)
        this.old = {
            position: this.target.style.position || 'unset',
            boxShadow: this.target.name.style.boxShadow || 'unset'
        }
        this.target.style.position = 'absolute'
        this.target.name.style.boxShadow = '3px 3px 5px rgba(0,0,0,0.25)'
        this.target.style.left = pos.x + 'px'
        this.target.style.top = pos.y + 'px'
    }

    _checkThreshold(e)
    {
        if (this.moving)
        {
            return true
        }
        else
        {
            if (utils.distance(this.down.x, this.down.y, e.pageX, e.pageY))
            {
                this.moving = true
                this._pickup()
                return true
            }
            else
            {
                return false
            }
        }
    }

    _findClosest(e, entry)
    {
        if (entry !== this.target)
        {
            const distance = utils.distanceToClosestCorner(e.pageX, e.pageY, entry)
            if (distance < this.closest.distance)
            {
                this.closest.distance = distance
                this.closest.leaf = entry
            }
            for (let child of entry.descendents)
            {
                this._findClosest(e, child)
            }
        }
    }

    _move(e)
    {
        function insertAfter(newNode, referenceNode)
        {
            referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
        }

        if (this.target && this._checkThreshold(e))
        {
            this.indicator.remove()
            this.target.style.left = e.pageX - this.offset.x + 'px'
            this.target.style.top = e.pageY - this.offset.y + 'px'
            this.closest = { distance: Infinity }
            for (let child of this.descendents)
            {
                this._findClosest(e, child)
            }
            const pos = utils.toGlobal(this.closest.leaf)
            if (e.pageY < pos.y + this.closest.leaf.offsetHeight / 2)
            {
                this.closest.leaf.parentNode.insertBefore(this.indicator, this.closest.leaf)
            }
            else
            {
                insertAfter(this.indicator, this.closest.leaf)
            }
        }
    }

    _up()
    {
        if (this.target)
        {
            if (!this.moving && this.options.expandOnClick)
            {
                this.toggleExpand(this.target)
            }
            if (this.holdTimeout)
            {
                window.clearTimeout(this.holdTimeout)
                this.holdTimeout = null
            }
            this.target = this.moving = null
        }
    }
}

module.exports = Tree

/**
 * @typedef {Object} Tree~TreeData
 * @property {TreeData[]} children
 * @property {string} name
 * @property {parent} [parent] if not provided then will traverse tree to find parent
 */