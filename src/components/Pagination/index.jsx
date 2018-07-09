import React from 'react'
import { navigateTo } from 'gatsby-link'
import IconButton from 'material-ui/IconButton'
import ChevronLeftIcon from 'material-ui/svg-icons/navigation/chevron-left'
import ChevronRightIcon from 'material-ui/svg-icons/navigation/chevron-right'

export default ({ pageInfo }) => {
  const { prev, next, page, pages } = pageInfo
  return (
    <div style={style.pagination}>
      {prev ? (
        <IconButton onClick={() => navigateTo(prev)}>
          <ChevronLeftIcon />
        </IconButton>
      ) : (
        <span />
      )}
      <span style={style.page}>
        Page {page} of {pages}
      </span>
      {next ? (
        <IconButton onClick={() => navigateTo(next)}>
          <ChevronRightIcon />
        </IconButton>
      ) : (
        <span />
      )}
    </div>
  )
}

const style = {
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '30px',
  },
  page: {
    lineHeight: '48px'
  }
}
