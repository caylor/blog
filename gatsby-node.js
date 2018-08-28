/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */
const path = require('path')
const slash = require('slash')
const { createFilePath } = require('gatsby-source-filesystem')
const { createPaginationPages } = require('gatsby-pagination')
const _ = require('lodash')

exports.onCreateNode = ({ node, getNode, boundActionCreators }) => {
  const { createNodeField } = boundActionCreators
  if (node.internal.type === `MarkdownRemark`) {
    const fildNode = getNode(node.parent)
    const pathParsed = path.parse(fildNode.relativePath)
    const slug =
      pathParsed.dir === 'about'
        ? '/about'
        : path.posix.join(
            '/',
            pathParsed.dir,
            _.kebabCase(node.frontmatter.title),
            '/'
          )
    createNodeField({
      node,
      name: `slug`,
      value: slug
    })
  }
}

exports.createPages = ({ graphql, boundActionCreators }) => {
  const { createPage } = boundActionCreators

  return new Promise((resolve, reject) => {
    graphql(`
      {
        allMarkdownRemark(sort: { order: DESC, fields: [frontmatter___date] }) {
          edges {
            node {
              id
              fields {
                slug
              }
              frontmatter {
                title
                date
                tags
              }
              excerpt
            }
          }
        }
      }
    `).then(result => {
      if (result.errors) {
        return reject(result.errors)
      }

      const posts = result.data.allMarkdownRemark.edges

      createPaginationPages({
        createPage: createPage,
        edges: _.filter(posts, ({ node }) => node.fields.slug !== '/about'),
        component: slash(path.resolve('./src/templates/post-list.jsx')),
        pathFormatter: route => `/${route !== 1 ? 'blog/' + route : ''}`,
        limit: 8
      })

      posts.forEach(({ node }) => {
        createPage({
          path: node.fields.slug,
          component: slash(path.resolve('./src/templates/blog-post.jsx')),
          context: {
            slug: node.fields.slug
          }
        })
      })

      const tags = posts.reduce(
        (tags, { node }) => tags.concat(node.frontmatter.tags),
        []
      )
      const tagFormatter = tag => route =>
        `/tags/${_.kebabCase(tag)}/${route !== 1 ? route : ''}`

      _.compact(_.uniq(tags)).forEach(tag => {
        createPaginationPages({
          createPage: createPage,
          edges: _.filter(
            posts,
            ({ node }) =>
              node.frontmatter.tags && node.frontmatter.tags.includes(tag)
          ),
          component: slash(path.resolve('./src/templates/post-list.jsx')),
          limit: 8,
          pathFormatter: tagFormatter(tag),
          context: {
            tag
          }
        })
      })

      resolve()
    })
  })
}
