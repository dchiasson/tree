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
     * @param {number} [options.indentation=20] number of pixels to indent for each level
     * @param {number} [options.threshold=10] number of pixels to move to start a drag
     * @param {number} [options.holdTime=2000] number of milliseconds before name can be edited (set to 0 to disable)
     * @param {boolean} [options.expandOnClick=true] expand and collapse node on click without drag
     * @param {number} [options.dragOpacity=0.75] opacity setting for dragged item
     * @param {string[]} [options.nameStyles]
     * @param {string[]} [options.indicatorStyles]
     * @fires expand
     * @fires collapse
     * @fires name-change
     * @fires move-pending
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
        this.indicator.icon = utils.html({ parent: content, defaultStyles: this.options.expandStyles, styles: { height: 0 } })
        this.indicator.line = utils.html({
            parent: content,
            styles: this.options.indicatorStyles
        })
    }

    leaf(data, level)
    {
        const leaf = utils.html()
        leaf.isLeaf = true
        leaf.data = data
        const content = utils.html({ parent: leaf, styles: { display: 'flex', alignItems: 'center' } })
        leaf.indentation = utils.html({ parent: content, styles: { width: level * this.options.indentation + 'px' } })
        leaf.icon = utils.html({ parent: content, html: data[this.options.expanded] ? icons.open : icons.closed, styles: this.options.expandStyles })
        leaf.name = utils.html({ parent: content, html: data[this.options.name], styles: this.options.nameStyles })

        leaf.name.addEventListener('mousedown', (e) => this._down(e))
        leaf.name.addEventListener('touchstart', (e) => this._down(e))
        for (let child of data[this.options.children])
        {
            const add = this.leaf(child, level + 1)
            leaf.appendChild(add)
            if (!data[this.options.expanded])
            {
                add.style.display = 'none'
            }
        }
        if (this._getChildren(leaf).length === 0)
        {
            this._hideIcon(leaf)
        }
        clicked(leaf.icon, () => this.toggleExpand(leaf))
        return leaf
    }

    _getChildren(leaf)
    {
        leaf = leaf || this.element
        const children = []
        for (let child of leaf.children)
        {
            if (child.isLeaf)
            {
                children.push(child)
            }
        }
        return children
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
        this._expandChildren(this.element)
    }

    _expandChildren(leaf)
    {
        for (let child of this._getChildren(leaf))
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
        for (let child of this._getChildren(leaf))
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
        const children = this._getChildren(leaf)
        if (children.length)
        {
            this.emit('expand', leaf, this)
            for (let child of children)
            {
                child.style.display = 'block'
            }
            leaf.data[this.options.expanded] = true
            leaf.icon.innerHTML = icons.open
        }
    }

    collapse(leaf)
    {
        const children = this._getChildren(leaf)
        if (children.length)
        {
            this.emit('collapse', leaf, this)
            for (let child of children)
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
        for (let leaf of this.tree[this.options.children])
        {
            const add = this.leaf(leaf, 0)
            this.element.appendChild(add)
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

    _setIndicator()
    {
        let level = 0
        let traverse = this.indicator.parentNode
        while (traverse !== this.element)
        {
            level++
            traverse = traverse.parentNode
        }
        this.indicator.indentation.style.width = level * this.options.indentation + 'px'
    }

    _pickup()
    {
        if (this.holdTimeout)
        {
            window.clearTimeout(this.holdTimeout)
            this.holdTimeout = null
        }
        this.emit('move-pending', this.target, this)
        const parent = this.target.parentNode
        parent.insertBefore(this.indicator, this.target)
        this._setIndicator(this.target)
        const pos = utils.toGlobal(this.target)
        document.body.appendChild(this.target)
        this.old = {
            opacity: this.target.style.opacity || 'unset',
            position: this.target.style.position || 'unset',
            boxShadow: this.target.name.style.boxShadow || 'unset'
        }
        this.target.style.position = 'absolute'
        this.target.name.style.boxShadow = '3px 3px 5px rgba(0,0,0,0.25)'
        this.target.style.left = pos.x + 'px'
        this.target.style.top = pos.y + 'px'
        this.target.style.opacity = this.options.dragOpacity
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
        if (this.closest.found)
        {
            return
        }
        if (utils.inside(e.pageX, e.pageY, entry.name))
        {
            this.closest.found = true
            this.closest.leaf = entry
            return
        }
        const distance = utils.distanceToClosestCorner(e.pageX, e.pageY, entry.name)
        if (distance < this.closest.distance)
        {
            this.closest.distance = distance
            this.closest.leaf = entry
        }
        for (let child of this._getChildren(entry))
        {
            this._findClosest(e, child)
        }
    }

    _firstChild(leaf)
    {
        const children = this._getChildren(leaf)
        {
            if (children.length)
            {
                return children[0]
            }
            else
            {
                return null
            }
        }
    }

    _hasPreviousSibling(leaf)
    {
        const children = this._getChildren(leaf.parentNode)
        return children.indexOf(leaf) !== 0
    }

    _isLastElement(leaf)
    {
        if (leaf.nextElementSibling || this._getChildren(leaf).length)
        {
            return false
        }
        let parent = leaf.parentNode
        while (parent !== this.element)
        {
            if (parent.nextElementSibling)
            {
                return false
            }
            parent = parent.parentNode
        }
        return true
    }

    _move(e)
    {
        if (this.target && this._checkThreshold(e))
        {
            this.indicator.remove()
            this.target.style.left = e.pageX - this.offset.x + 'px'
            this.target.style.top = e.pageY - this.offset.y + 'px'
            this.closest = { distance: Infinity }
            for (let child of this._getChildren())
            {
                this._findClosest(e, child)
            }
            let pos = utils.toGlobal(this.closest.leaf.name)
            const target = utils.toGlobal(this.target.name)
            let append, under = true
            if (e.pageY > pos.y + this.closest.leaf.name.offsetHeight / 2)
            {
                const firstChild = this._firstChild(this.closest.leaf)
                if (firstChild)
                {
                    this.closest.leaf = firstChild
                }
                else
                {
                    under = false
                    if (this.closest.leaf.nextElementSibling)
                    {
                        this.closest.leaf = this.closest.leaf.nextElementSibling
                        pos = utils.toGlobal(this.closest.leaf.name)
                    }
                    else
                    {
                        append = true
                    }
                }
            }
            if (append)
            {
                let test = this.closest.leaf.parentNode
                while (test && target.x < pos.x - this.options.indentation)
                {
                    pos = utils.toGlobal(test)
                    test = test.parentNode
                }
                test.parentNode.appendChild(this.indicator)
            }
            else if (this._hasPreviousSibling(this.closest.leaf) && target.x > pos.x + this.options.indentation)
            {
                this.closest.leaf.insertBefore(this.indicator, under ? this.closest.leaf.firstChild : this.closest.leaf.lastChild)
            }
            else
            {
                this.closest.leaf.parentNode.insertBefore(this.indicator, this.closest.leaf)
            }
            this._setIndicator()
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
            else if (this.moving)
            {
                this.indicator.parentNode.insertBefore(this.target, this.indicator)
                this.target.style.position = this.old.position === 'unset' ? '' : this.old.position
                this.target.name.style.boxShadow = this.old.boxShadow === 'unset' ? '' : this.old.boxShadow
                this.target.style.opacity = this.old.opacity === 'unset' ? '' : this.old.opacity
                this.target.indentation.style.width = this.indicator.indentation.offsetWidth + 'px'
                this.indicator.remove()
                this.emit('move', this.target, this)
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

/**
  * trigger when expand is called either through UI interaction or Tree.expand()
  * @event Tree~expand
  * @type {object}
  * @property {HTMLElement} tree element
  * @property {Tree} Tree
  */

/**
  * trigger when collapse is called either through UI interaction or Tree.expand()
  * @event Tree~collapse
  * @type {object}
  * @property {HTMLElement} tree element
  * @property {Tree} Tree
  */

/**
  * trigger when name is change either through UI interaction or Tree.nameChange()
  * @event Tree~name-change
  * @type {object}
  * @property {HTMLElement} tree element
  * @property {string} name
  * @property {Tree} Tree
  */

/**
  * trigger when a leaf is picked up through UI interaction
  * @event Tree~move-pending
  * @type {object}
  * @property {HTMLElement} tree element
  * @property {Tree} Tree
  */