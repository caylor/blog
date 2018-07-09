import React from 'react'
import PostList from '../components/PostList'
import Pagination from '../components/Pagination'

export default ({ pathContext }) => {
  const { nodes, ...pageInfo } = pathContext
  
  return (
    <div>
      <PostList data={nodes} />
      <Pagination pageInfo={pageInfo} />
    </div>
  )
}
